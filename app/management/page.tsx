"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// API
import {
  getStore,
  createStore,
  updateStore,
  deleteStore,
} from "@/lib/store/storeApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import {
  getAllUsersWithDetails,
  getUser,
  createUser as createUserApi,
  updateUser,
  deleteUser,
} from "@/lib/user/userApi";
import { getTenantId } from "@/lib/helper/getTenantId";
import { getTenantById } from "@/lib/tenant/tenantApi";

type Role = "Admin" | "Manager" | "Cashier";
type Branch = { id: string; name: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  store_ids: string[];
};

type ToastType = "success" | "error" | "warning" | "info";
type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
};

type ConfirmDialog = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type: "danger" | "warning" | "info";
};

type PromptDialog = {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder: string;
  defaultValue: string;
  confirmText: string;
  cancelText: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

function uid(prefix = "") {
  return `${prefix}${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)
  }`;
}

export default function ManagementPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string>("");
  const [activeTenantName, setActiveTenantName] = useState<string>("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branchQuery, setBranchQuery] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  // Toast and Dialog states
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    cancelText: "",
    onConfirm: () => {},
    onCancel: () => {},
    type: "info",
  });
  const [promptDialog, setPromptDialog] = useState<PromptDialog>({
    isOpen: false,
    title: "",
    message: "",
    placeholder: "",
    defaultValue: "",
    confirmText: "",
    cancelText: "",
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [promptValue, setPromptValue] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Cashier" as Role,
    storeIds: [] as string[],
  });

  // Toast functions
  const addToast = (type: ToastType, title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showConfirm = (options: Omit<ConfirmDialog, "isOpen">) => {
    setConfirmDialog({ ...options, isOpen: true });
  };

  const showPrompt = (options: Omit<PromptDialog, "isOpen">) => {
    setPromptValue(options.defaultValue || "");
    setPromptDialog({ ...options, isOpen: true });
  };

  const pwOk = editing
    ? true
    : form.password.length >= 8 &&
      /[A-Za-z]/.test(form.password) &&
      /\d/.test(form.password);

  /** Auth listener */
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setAuthed(!!data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => {
        if (active) setAuthed(!!session);
      }
    );
    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  /** Initial fetch: tenant → stores, users */
  useEffect(() => {
    if (authed !== true) return;
    let cancelled = false;
    (async () => {
      setLoadingBranches(true);
      try {
        const tid = (await getTenantId()) ?? "";
        if (cancelled) return;
        setActiveTenantId(tid);

        if (!tid) {
          setBranches([]);
          setUsers([]);
          setActiveTenantName("");
          return;
        }

        const token = await getAccessToken();

        // Fetch tenant details to get the name
        const tenantDetails = await getTenantById(tid, token);
        if (tenantDetails) {
          setActiveTenantName(tenantDetails.name);
        }

        // Debug: Check what's in the token
        try {
          const tokenParts = token.split(".");
          const payload = JSON.parse(atob(tokenParts[1]));

          // Extract user role from app_metadata.role array
          const roles = payload.app_metadata?.role || [];
          const currentRole = roles.length > 0 ? roles[0] : "";
          setUserRole(currentRole);

          console.log("User role:", currentRole);
        } catch (e) {
          // Token decode error
          setUserRole("");
        }

        // Try both store API and tenant API approaches
        let storesResponse;
        let remoteUsers;

        try {
          [storesResponse, remoteUsers] = await Promise.all([
            getStore(token), // Get stores
            getAllUsersWithDetails(token), // Get all users with complete details
          ]);
        } catch (storeError) {
          // Store API failed, might need different approach
          // If store API fails, you might need to implement a different approach
          // For now, set empty response
          storesResponse = [];
          remoteUsers = [];
        }
        if (cancelled) return;

        // Handle different response formats based on user role
        let stores = [];

        if (Array.isArray(storesResponse)) {
          // Direct array response
          stores = storesResponse;
        } else if (
          storesResponse?.stores &&
          Array.isArray(storesResponse.stores)
        ) {
          // Response with stores property (tenant API format)
          stores = storesResponse.stores;
        } else if (storesResponse?.id && storesResponse?.name) {
          // Single store object (non-OWNER/MANAGER response)
          stores = [storesResponse];
        } else if (storesResponse?.data && Array.isArray(storesResponse.data)) {
          // Response wrapped in data property
          stores = storesResponse.data;
        } else {
          // Fallback - using fallback
          stores = [];
        }

        const validStores = stores.filter((store: any) => {
          const isValid = store && store.id && store.name;
          if (!isValid) {
            // Invalid store filtered out
          }
          return isValid;
        });

        setBranches(validStores);

        // Handle users response - the backend returns different formats
        // The getUser function now returns a properly formatted array of users
        let finalUsers = [];
        if (Array.isArray(remoteUsers)) {
          // getUser function returns array directly
          finalUsers = remoteUsers;
        } else {
          // Unexpected format
          finalUsers = [];
        }

        setUsers(finalUsers);
      } catch (e) {
        // Init failed
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const branchesById = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(branches) ? branches : []).map(
          (b) => [b.id, b.name] as const
        )
      ),
    [branches]
  );

  /** Branch create */
  const addBranch = async () => {
    showPrompt({
      title: "Шинэ салбар үүсгэх",
      message: "Шинэ салбарын нэрийг оруулна уу:",
      placeholder: "Салбарын нэр...",
      defaultValue: "",
      confirmText: "Үүсгэх",
      cancelText: "Болих",
      onConfirm: async (nm) => {
        const name = nm.trim();
        if (!name) {
          addToast("warning", "Анхааруулга", "Салбарын нэр оруулна уу");
          return;
        }

        const tempId = uid("tmp_");
        setBranches((prev) => [{ id: tempId, name }, ...prev]);
        try {
          const token = await getAccessToken();
          const storeResponse = await createStore([name], token);

          // Handle the response format
          let newStore;
          if (Array.isArray(storeResponse)) {
            // If the response is an array of stores
            newStore = storeResponse[0];
          } else if (
            storeResponse?.stores &&
            Array.isArray(storeResponse.stores)
          ) {
            // If wrapped in stores property
            newStore = storeResponse.stores[0];
          } else if (storeResponse?.id && storeResponse?.name) {
            // If it's a single store object
            newStore = storeResponse;
          } else {
            // If all else fails, show error
            throw new Error("Invalid response format from server");
          }

          if (newStore && newStore.id && newStore.name) {
            setBranches((prev) =>
              prev.map((b) =>
                b.id === tempId ? { id: newStore.id, name: newStore.name } : b
              )
            );
            addToast("success", "Амжилттай", `"${name}" салбар үүсгэгдлээ`);
          } else {
            throw new Error("Created store missing id or name");
          }

          if (!activeTenantId) {
            const tid = (await getTenantId()) ?? "";
            setActiveTenantId(tid);
          }
        } catch (e: any) {
          setBranches((prev) => prev.filter((b) => b.id !== tempId));
          addToast(
            "error",
            "Алдаа",
            "Салбар нэмэхэд алдаа: " + (e?.message || "Unknown")
          );
        }
        setPromptDialog((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setPromptDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  /** Users CRUD */
  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role: "Cashier",
      storeIds: [], // Default to empty - admins don't need specific branch assignments
    });
    setOpen(true);
  };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      storeIds: [...(u.store_ids || [])],
    });
    setOpen(true);
  };

  const saveUser = async () => {
    if (!activeTenantId) {
      addToast("error", "Алдаа", "Tenant мэдээлэл олдсонгүй");
      return;
    }
    try {
      if (editing) {
        const token = await getAccessToken();
        await updateUser(
          editing.id,
          form.role,
          form.storeIds,
          form.name,
          token
        );
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editing.id
              ? {
                  ...u,
                  name: form.name,
                  role: form.role,
                  store_ids: [...form.storeIds],
                }
              : u
          )
        );
        addToast(
          "success",
          "Амжилттай",
          `"${form.name}" хэрэглэгч шинэчлэгдлээ`
        );
      } else {
        if (!form.email.trim()) {
          addToast("warning", "Анхааруулга", "И-мэйл хаягаа оруулна уу");
          return;
        }
        if (!pwOk) {
          addToast(
            "warning",
            "Анхааруулга",
            "Нууц үг 8+, үсэг ба тоо агуулсан байх ёстой"
          );
          return;
        }
        const token = await getAccessToken();
        const res = await createUserApi(
          form.email.trim().toLowerCase(),
          form.password,
          form.role,
          form.storeIds,
          form.name.trim(),
          token
        );
        const newRow: UserRow = {
          id: String(res.id || res.user_id),
          name: form.name || form.email.split("@")[0],
          email: form.email.trim().toLowerCase(),
          role: form.role,
          store_ids: [...form.storeIds],
        };
        setUsers((prev) => [newRow, ...prev]);
        addToast("success", "Амжилттай", `"${form.name}" хэрэглэгч үүсгэгдлээ`);
      }
      setOpen(false);
    } catch (e: any) {
      addToast(
        "error",
        "Алдаа",
        e?.message || "Хэрэглэгч хадгалах явцад алдаа гарлаа"
      );
    }
  };

  const confirmDelete = async (u: UserRow) => {
    if (!activeTenantId) {
      addToast("error", "Алдаа", "Tenant мэдээлэл олдсонгүй");
      return;
    }

    // Check if this is an Admin/Owner user
    if (u.role === "Admin" || u.role === "Manager") {
      // Count how many other Admin/Owner users exist
      const otherAdmins = users.filter(
        (user) =>
          user.id !== u.id && (user.role === "Admin" || user.role === "Manager")
      );

      if (otherAdmins.length === 0) {
        addToast(
          "warning",
          "Анхааруулга",
          "Хамгийн сүүлийн админ хэрэглэгчийг устгах боломжгүй. Эхлээд өөр админ хэрэглэгч үүсгэнэ үү."
        );
        return;
      }

      showConfirm({
        title: "АНХААРУУЛГА: Админ хэрэглэгч устгах",
        message: `"${u.name}" нь админ хэрэглэгч байна. Үүнийг устгахдаа итгэлтэй байна уу?`,
        confirmText: "Тийм, устгах",
        cancelText: "Болих",
        type: "danger",
        onConfirm: () => performDeleteUser(u),
        onCancel: () =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } else {
      showConfirm({
        title: "Хэрэглэгч устгах",
        message: `"${u.name}" хэрэглэгчийг устгах уу?`,
        confirmText: "Устгах",
        cancelText: "Болих",
        type: "warning",
        onConfirm: () => performDeleteUser(u),
        onCancel: () =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  const performDeleteUser = async (u: UserRow) => {
    try {
      const token = await getAccessToken();
      const response = await deleteUser(u.id, token);

      // Check if the response indicates success
      if (response.error) {
        throw new Error(response.error);
      }

      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      addToast("success", "Амжилттай", "Хэрэглэгч устгагдлаа");
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    } catch (e: any) {
      // Handle error messages from the backend
      let errorMessage = "Устгах явцад алдаа гарлаа.";

      if (e.message) {
        errorMessage = e.message;
      } else if (e.error) {
        errorMessage = e.error;
      }

      addToast("error", "Алдаа", errorMessage);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  /** Branch CRUD */
  const editBranch = async (branch: Branch) => {
    showPrompt({
      title: "Салбарын нэр засах",
      message: "Салбарын шинэ нэрийг оруулна уу:",
      placeholder: "Салбарын нэр...",
      defaultValue: branch.name,
      confirmText: "Хадгалах",
      cancelText: "Болих",
      onConfirm: async (newName) => {
        const name = newName.trim();
        if (!name || name === branch.name) {
          setPromptDialog((prev) => ({ ...prev, isOpen: false }));
          return;
        }

        try {
          const token = await getAccessToken();
          await updateStore(branch.id, name, token);
          setBranches((prev) =>
            prev.map((b) => (b.id === branch.id ? { ...b, name } : b))
          );
          addToast(
            "success",
            "Амжилттай",
            `Салбарын нэр "${name}" болж өөрчлөгдлөө`
          );
        } catch (e: any) {
          addToast(
            "error",
            "Алдаа",
            "Салбар засахад алдаа: " + (e?.message || "Unknown")
          );
        }
        setPromptDialog((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setPromptDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const confirmDeleteBranch = async (branch: Branch) => {
    showConfirm({
      title: "Салбар устгах",
      message: `"${branch.name}" салбарыг устгах уу?`,
      confirmText: "Устгах",
      cancelText: "Болих",
      type: "warning",
      onConfirm: () => performDeleteBranch(branch),
      onCancel: () => setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const performDeleteBranch = async (branch: Branch) => {
    try {
      const token = await getAccessToken();
      await deleteStore(branch.id, token);
      setBranches((prev) => prev.filter((b) => b.id !== branch.id));
      addToast("success", "Амжилттай", `"${branch.name}" салбар устгагдлаа`);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    } catch (e: any) {
      addToast(
        "error",
        "Алдаа",
        "Салбар устгахад алдаа: " + (e?.message || "Unknown")
      );
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  /** UI */
  const router = useRouter();
  const goToDashboard = () => router.push("/dashboard");

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
      }
    }
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F7F5] to-[#EFEEE8] p-6 text-black">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={goToDashboard}
            className="bg-white rounded-lg border border-[#E6E6E6] shadow-lg hover:shadow-xl transition-all duration-200 h-12 px-6 text-black inline-flex items-center justify-center font-medium hover:bg-gray-50"
          >
            ← Буцах
          </button>
          <div className="hidden sm:block">
            <h1 className="text-2xl font-bold text-gray-900">Удирдлага</h1>
            <p className="text-sm text-gray-600 mt-1">
              Хэрэглэгч болон салбарын удирдлага
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg px-4 py-2 shadow-md border border-[#E6E6E6]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Tenant
          </div>
          <div className="font-semibold text-gray-900">
            {activeTenantName || activeTenantId || "—"}
          </div>
        </div>
      </header>

      {/* Users Section */}
      <section className="bg-white rounded-2xl shadow-xl border border-[#E6E6E6] p-6 mb-8 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              👥 Хэрэглэгчид
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Системийн хэрэглэгчдийг удирдах
            </p>
          </div>
          {userRole !== "CASHIER" && (
            <button
              onClick={openCreate}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#5AA6FF] to-[#4A96E8] text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium flex items-center gap-2 hover:scale-105"
            >
              ✨ Хэрэглэгч үүсгэх
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full bg-white">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr className="text-left text-gray-700">
                <th className="py-4 px-6 font-semibold">Нэр</th>
                <th className="py-4 px-6 font-semibold">И-мэйл</th>
                <th className="py-4 px-6 font-semibold">Эрх</th>
                <th className="py-4 px-6 font-semibold">Салбар</th>
                <th className="py-4 px-6 font-semibold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u, index) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          u.role === "Admin"
                            ? "bg-red-500"
                            : u.role === "Manager"
                            ? "bg-blue-500"
                            : "bg-green-500"
                        }`}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          #{u.id.slice(-6)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-700">{u.email}</td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        u.role === "Admin"
                          ? "bg-red-100 text-red-800"
                          : u.role === "Manager"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {u.role === "Admin" || u.role === "Manager" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        🌟 Бүх салбар
                      </span>
                    ) : u.store_ids?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {u.store_ids.slice(0, 2).map((id) => (
                          <span
                            key={id}
                            className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                          >
                            {branchesById[id] || "Unknown"}
                          </span>
                        ))}
                        {u.store_ids.length > 2 && (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                            +{u.store_ids.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {userRole !== "CASHIER" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="h-9 px-4 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors duration-150 font-medium"
                        >
                          ✏️ Засах
                        </button>
                        <button
                          onClick={() => confirmDelete(u)}
                          className="h-9 px-4 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors duration-150 font-medium"
                        >
                          🗑️ Устгах
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="py-12 text-center text-gray-500" colSpan={5}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl">👤</div>
                      <div className="font-medium">Хэрэглэгч байхгүй байна</div>
                      <div className="text-sm">
                        Шинэ хэрэглэгч нэмж эхлээрэй
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Branches Section */}
      <section className="bg-white rounded-2xl shadow-xl border border-[#E6E6E6] p-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              🏢 Салбарууд
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Дэлгүүрийн салбаруудыг удирдах
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input
                placeholder="🔍 Хайх..."
                className="h-11 pl-4 pr-4 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                value={branchQuery}
                onChange={(e) => setBranchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setLoadingBranches(true);
                getAccessToken()
                  .then((token) => getStore(token))
                  .then((storesResponse: any) => {
                    let stores = [];
                    if (Array.isArray(storesResponse)) {
                      stores = storesResponse;
                    } else if (
                      storesResponse?.stores &&
                      Array.isArray(storesResponse.stores)
                    ) {
                      stores = storesResponse.stores;
                    } else if (storesResponse?.id && storesResponse?.name) {
                      stores = [storesResponse];
                    } else if (
                      storesResponse?.data &&
                      Array.isArray(storesResponse.data)
                    ) {
                      stores = storesResponse.data;
                    } else {
                      stores = [];
                    }
                    const validStores = stores.filter(
                      (store: any) => store && store.id && store.name
                    );
                    setBranches(validStores);
                  })
                  .catch((err: any) =>
                    addToast(
                      "error",
                      "Алдаа",
                      "[getStore] " + (err?.message || err)
                    )
                  )
                  .finally(() => setLoadingBranches(false));
              }}
              disabled={loadingBranches}
              className="h-11 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-all duration-200 font-medium"
            >
              {loadingBranches ? "🔄 Уншиж байна..." : "🔄 Шинэчлэх"}
            </button>
            {userRole !== "CASHIER" && (
              <button
                onClick={addBranch}
                className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#5AA6FF] to-[#4A96E8] text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium hover:scale-105"
              >
                ➕ Нэмэх
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full bg-white">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr className="text-left text-gray-700">
                <th className="py-4 px-6 font-semibold">Нэр</th>
                <th className="py-4 px-6 font-semibold">ID</th>
                <th className="py-4 px-6 font-semibold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches
                .filter(
                  (b) =>
                    !branchQuery.trim() ||
                    b.name?.toLowerCase().includes(branchQuery.toLowerCase())
                )
                .map((b, index) => (
                  <tr
                    key={b.id || `branch-${index}`}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                          🏬
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {b.name || "Нэргүй"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Салбар #{index + 1}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {b.id || "No ID"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {userRole !== "CASHIER" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => editBranch(b)}
                            className="h-9 px-4 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors duration-150 font-medium"
                          >
                            ✏️ Засах
                          </button>
                          <button
                            onClick={() => confirmDeleteBranch(b)}
                            className="h-9 px-4 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors duration-150 font-medium"
                          >
                            🗑️ Устгах
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              {branches.length === 0 && !loadingBranches && (
                <tr>
                  <td className="py-12 text-center text-gray-500" colSpan={3}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl">🏢</div>
                      <div className="font-medium">Салбар байхгүй байна</div>
                      <div className="text-sm">Шинэ салбар нэмж эхлээрэй</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Enhanced Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#5AA6FF] to-[#4A96E8] px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {editing ? "✏️ Хэрэглэгч засах" : "✨ Хэрэглэгч үүсгэх"}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1 transition-all duration-200"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Нэр
                  </label>
                  <input
                    className="w-full h-11 rounded-xl border border-gray-300 px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    placeholder="Бүтэн нэрээ оруулна уу"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    И-мэйл хаяг
                  </label>
                  <input
                    className="w-full h-11 rounded-xl border border-gray-300 px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 disabled:bg-gray-100"
                    placeholder="example@email.com"
                    type="email"
                    disabled={!!editing}
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>

                {!editing && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Нууц үг
                    </label>
                    <input
                      className="w-full h-11 rounded-xl border border-gray-300 px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      placeholder="Нууц үгээ оруулна уу"
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Хэрэглэгчийн эрх
                  </label>
                  <select
                    className="w-full h-11 rounded-xl border border-gray-300 px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    value={form.role}
                    onChange={(e) => {
                      const newRole = e.target.value as Role;
                      setForm((f) => ({
                        ...f,
                        role: newRole,
                        storeIds:
                          newRole === "Admin" || newRole === "Manager"
                            ? []
                            : f.storeIds,
                      }));
                    }}
                  >
                    {(["Admin", "Manager", "Cashier"] as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {r === "Admin"
                          ? "👑 Admin"
                          : r === "Manager"
                          ? "🎯 Manager"
                          : "👤 Cashier"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Store Selection */}
                <div className="md:col-span-2 space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Салбарын хандалт
                  </label>
                  {form.role === "Admin" || form.role === "Manager" ? (
                    <div className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                          <span className="text-white text-lg">🌟</span>
                        </div>
                        <div>
                          <p className="font-medium text-purple-900">
                            Бүх салбарт хандах эрхтэй
                          </p>
                          <p className="text-sm text-purple-700">
                            {form.role} хэрэглэгч автоматаар бүх салбарт хандах
                            эрх авна
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-auto rounded-xl border border-gray-300 p-4 bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {branches.map((s, index) => {
                          const checked = form.storeIds.includes(s.id);
                          return (
                            <label
                              key={s.id || `store-${index}`}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                                checked
                                  ? "border-blue-500 bg-blue-50 text-blue-900"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                checked={checked}
                                onChange={() =>
                                  setForm((f) => ({
                                    ...f,
                                    storeIds: checked
                                      ? f.storeIds.filter((x) => x !== s.id)
                                      : [...f.storeIds, s.id],
                                  }))
                                }
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🏢</span>
                                <span className="font-medium">
                                  {s.name || "Unnamed"}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                        {branches.length === 0 && (
                          <div className="col-span-2 text-center text-gray-500 py-8">
                            <div className="text-3xl mb-2">🏢</div>
                            <div>Салбар байхгүй байна</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Requirements */}
              {!editing && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Нууц үгийн шаардлага:
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        form.password.length >= 8
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      <span className="text-lg">
                        {form.password.length >= 8 ? "✅" : "⭕"}
                      </span>
                      <span>8+ тэмдэгт</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        /[A-Za-z]/.test(form.password)
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      <span className="text-lg">
                        {/[A-Za-z]/.test(form.password) ? "✅" : "⭕"}
                      </span>
                      <span>Үсэг агуулсан</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        /\d/.test(form.password)
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      <span className="text-lg">
                        {/\d/.test(form.password) ? "✅" : "⭕"}
                      </span>
                      <span>Тоо агуулсан</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="h-11 px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200"
                >
                  Болих
                </button>
                <button
                  onClick={saveUser}
                  className="h-11 px-8 rounded-xl bg-gradient-to-r from-[#5AA6FF] to-[#4A96E8] text-white font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                  disabled={
                    !activeTenantId || (!editing && (!form.email || !pwOk))
                  }
                >
                  {editing ? "💾 Хадгалах" : "✨ Үүсгэх"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-xl shadow-lg border p-4 transform transition-all duration-300 animate-in slide-in-from-right ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : toast.type === "warning"
                ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {toast.type === "success" && (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                )}
                {toast.type === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </div>
                )}
                {toast.type === "warning" && (
                  <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                      ></path>
                    </svg>
                  </div>
                )}
                {toast.type === "info" && (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{toast.title}</p>
                <p className="text-sm opacity-90">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div
              className={`px-6 py-4 ${
                confirmDialog.type === "danger"
                  ? "bg-gradient-to-r from-red-500 to-red-600"
                  : confirmDialog.type === "warning"
                  ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                  : "bg-gradient-to-r from-blue-500 to-blue-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  {confirmDialog.type === "danger" && (
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                      ></path>
                    </svg>
                  )}
                  {confirmDialog.type === "warning" && (
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                      ></path>
                    </svg>
                  )}
                  {confirmDialog.type === "info" && (
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {confirmDialog.title}
                </h3>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-6">{confirmDialog.message}</p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={confirmDialog.onCancel}
                  className="h-11 px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200"
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`h-11 px-6 rounded-xl font-medium transition-all duration-200 text-white ${
                    confirmDialog.type === "danger"
                      ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                      : confirmDialog.type === "warning"
                      ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Prompt Dialog */}
      {promptDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#5AA6FF] to-[#4A96E8] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    ></path>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {promptDialog.title}
                </h3>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">{promptDialog.message}</p>

              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptDialog.placeholder}
                className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-gray-900 placeholder-gray-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    promptDialog.onConfirm(promptValue);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    promptDialog.onCancel();
                  }
                }}
              />

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={promptDialog.onCancel}
                  className="h-11 px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200"
                >
                  {promptDialog.cancelText}
                </button>
                <button
                  onClick={() => promptDialog.onConfirm(promptValue)}
                  className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#5AA6FF] to-[#4A96E8] hover:from-[#4A96E8] hover:to-[#3A86D8] text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!promptValue.trim()}
                >
                  {promptDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
