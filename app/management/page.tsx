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
    const nm = prompt("Шинэ салбарын нэр?")?.trim();
    if (!nm) return;
    const tempId = uid("tmp_");
    setBranches((prev) => [{ id: tempId, name: nm }, ...prev]);
    try {
      const token = await getAccessToken();
      const storeResponse = await createStore([nm], token);

      // Handle the response format
      let newStore;
      if (Array.isArray(storeResponse)) {
        // If the response is an array of stores
        newStore = storeResponse[0];
      } else if (storeResponse?.stores && Array.isArray(storeResponse.stores)) {
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
      } else {
        throw new Error("Created store missing id or name");
      }

      if (!activeTenantId) {
        const tid = (await getTenantId()) ?? "";
        setActiveTenantId(tid);
      }
    } catch (e: any) {
      setBranches((prev) => prev.filter((b) => b.id !== tempId));
      alert("Салбар нэмэхэд алдаа: " + (e?.message || "Unknown"));
    }
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
    if (!activeTenantId) return alert("Tenant алга.");
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
      } else {
        if (!form.email.trim()) return alert("И-мэйлээ бөглөнө үү.");
        if (!pwOk) return alert("Нууц үг 8+, үсэг ба тоо агуулсан байх ёстой.");
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
      }
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || "Хэрэглэгч хадгалах явцад алдаа гарлаа.");
    }
  };

  const confirmDelete = async (u: UserRow) => {
    if (!activeTenantId) return alert("Tenant алга.");

    // Check if this is an Admin/Owner user
    if (u.role === "Admin" || u.role === "Manager") {
      // Count how many other Admin/Owner users exist
      const otherAdmins = users.filter(
        (user) =>
          user.id !== u.id && (user.role === "Admin" || user.role === "Manager")
      );

      if (otherAdmins.length === 0) {
        alert(
          "Хамгийн сүүлийн админ хэрэглэгчийг устгах боломжгүй. Эхлээд өөр админ хэрэглэгч үүсгэнэ үү."
        );
        return;
      }

      if (
        !confirm(
          `АНХААРУУЛГА: "${u.name}" нь админ хэрэглэгч байна. Үүнийг устгахдаа итгэлтэй байна уу?`
        )
      )
        return;
    } else {
      if (!confirm(`"${u.name}" хэрэглэгчийг устгах уу?`)) return;
    }

    try {
      const token = await getAccessToken();

      const response = await deleteUser(u.id, token);

      // Check if the response indicates success
      if (response.error) {
        throw new Error(response.error);
      }

      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      alert("Хэрэглэгч амжилттай устгагдлаа.");
    } catch (e: any) {
      // Handle error messages from the backend
      let errorMessage = "Устгах явцад алдаа гарлаа.";

      if (e.message) {
        errorMessage = e.message;
      } else if (e.error) {
        errorMessage = e.error;
      }

      alert(errorMessage);
    }
  };

  /** Branch CRUD */
  const editBranch = async (branch: Branch) => {
    const newName = prompt("Салбарын шинэ нэр?", branch.name)?.trim();
    if (!newName || newName === branch.name) return;

    try {
      const token = await getAccessToken();
      await updateStore(branch.id, newName, token);
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, name: newName } : b))
      );
    } catch (e: any) {
      alert("Салбар засахад алдаа: " + (e?.message || "Unknown"));
    }
  };

  const confirmDeleteBranch = async (branch: Branch) => {
    if (!confirm(`"${branch.name}" салбарыг устгах уу?`)) return;

    try {
      const token = await getAccessToken();
      await deleteStore(branch.id, token);
      setBranches((prev) => prev.filter((b) => b.id !== branch.id));
    } catch (e: any) {
      alert("Салбар устгахад алдаа: " + (e?.message || "Unknown"));
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
    <div className="min-h-dvh bg-[#F7F7F5] p-5 text-black">
      <header className="flex items-center justify-between">
        <button
          onClick={goToDashboard}
          className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-10 my-5 text-black inline-flex items-center justify-center"
        >
          Буцах
        </button>
        <div className="text-sm text-black/60">
          Tenant:{" "}
          <span className="font-medium">
            {activeTenantName || activeTenantId || "—"}
          </span>
        </div>
      </header>

      {/* Users */}
      <section className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Хэрэглэгчид</h2>
          {userRole !== "CASHIER" && (
            <button
              onClick={openCreate}
              className="h-10 px-4 rounded-md bg-[#5AA6FF] text-white shadow"
            >
              + Хэрэглэгч үүсгэх
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-black/60 border-b">
                <th className="py-2 pr-3">Нэр</th>
                <th className="py-2 pr-3">И-мэйл</th>
                <th className="py-2 pr-3">Эрх</th>
                <th className="py-2 pr-3">Салбар</th>
                <th className="py-2 pr-3">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{u.name}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{u.role}</td>
                  <td className="py-2 pr-3">
                    {u.role === "Admin" || u.role === "Manager" ? (
                      <span className="text-sm text-green-600 font-medium">
                        -
                      </span>
                    ) : u.store_ids?.length ? (
                      u.store_ids
                        .map((id) => branchesById[id] || "Тодорхойгүй салбар")
                        .join(", ")
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {userRole !== "CASHIER" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="h-8 px-3 rounded-md bg-[#E7F0FF] text-[#1B5FFF]"
                        >
                          Засах
                        </button>
                        <button
                          onClick={() => confirmDelete(u)}
                          className="h-8 px-3 rounded-md bg-[#FFE2E2] text-[#B42318]"
                        >
                          Устгах
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-black/50" colSpan={5}>
                    Хэрэглэгч алга
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Branches */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Салбарууд</h2>
          <div className="flex gap-2">
            <input
              placeholder="Хайх…"
              className="h-9 rounded-md border border-[#E6E6E6] px-3"
              value={branchQuery}
              onChange={(e) => setBranchQuery(e.target.value)}
            />
            <button
              onClick={() => {
                setLoadingBranches(true);
                getAccessToken()
                  .then((token) => getStore(token))
                  .then((storesResponse: any) => {
                    // Handle different response formats based on user role
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
                    alert("[getStore] " + (err?.message || err))
                  )
                  .finally(() => setLoadingBranches(false));
              }}
              disabled={loadingBranches}
              className="h-9 px-3 rounded-md bg-black/80 text-white disabled:opacity-50"
            >
              {loadingBranches ? "Уншиж байна…" : "Шинэчлэх"}
            </button>
            {userRole !== "CASHIER" && (
              <button
                onClick={addBranch}
                className="h-9 px-4 rounded-md bg-[#5AA6FF] text-white"
              >
                + Нэмэх
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-black/60 border-b">
                <th className="py-2 pr-3">Нэр</th>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {branches
                .filter(
                  (b) =>
                    !branchQuery.trim() ||
                    b.name?.toLowerCase().includes(branchQuery.toLowerCase())
                )
                .map((b, index) => (
                  <tr
                    key={b.id || `branch-${index}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-2 pr-3 font-medium">
                      {b.name || "Нэргүй"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-black/50">
                      {b.id || "No ID"}
                    </td>
                    <td className="py-2 pr-3">
                      {userRole !== "CASHIER" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => editBranch(b)}
                            className="h-8 px-3 rounded-md bg-[#E7F0FF] text-[#1B5FFF]"
                          >
                            Засах
                          </button>
                          <button
                            onClick={() => confirmDeleteBranch(b)}
                            className="h-8 px-3 rounded-md bg-[#FFE2E2] text-[#B42318]"
                          >
                            Устгах
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              {branches.length === 0 && !loadingBranches && (
                <tr>
                  <td className="py-6 text-center text-black/50" colSpan={3}>
                    Салбар олдсонгүй
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editing ? "Хэрэглэгч засах" : "Хэрэглэгч үүсгэх"}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-black/60 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="h-10 rounded-md border px-3"
                placeholder="Нэр"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <input
                className="h-10 rounded-md border px-3"
                placeholder="И-мэйл"
                type="email"
                disabled={!!editing}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
              {!editing && (
                <input
                  className="h-10 rounded-md border px-3"
                  placeholder="Нууц үг (8+, үсэг+тоо)"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              )}
              <select
                className="h-10 rounded-md border px-2"
                value={form.role}
                onChange={(e) => {
                  const newRole = e.target.value as Role;
                  setForm((f) => ({
                    ...f,
                    role: newRole,
                    // Clear store assignments for Admin/Manager roles
                    storeIds:
                      newRole === "Admin" || newRole === "Manager"
                        ? []
                        : f.storeIds,
                  }));
                }}
              >
                {(["Admin", "Manager", "Cashier"] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {/* multi-select stores */}
              <div className="md:col-span-2">
                <div className="text-sm font-medium mb-1">Салбарууд</div>
                {form.role === "Admin" || form.role === "Manager" ? (
                  <div className="rounded-md border p-3 bg-blue-50 text-blue-700">
                    <p className="text-sm">
                      {form.role} хэрэглэгч бүх салбарт автоматаар хандах
                      эрхтэй. Тусгай салбар сонгох шаардлагагүй.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-auto rounded-md border p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {branches.map((s, index) => {
                      const checked = form.storeIds.includes(s.id);
                      return (
                        <label
                          key={s.id || `store-${index}`}
                          className="inline-flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="accent-blue-600"
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
                          <span>{s.name || "Unnamed"}</span>
                        </label>
                      );
                    })}
                    {branches.length === 0 && (
                      <div className="text-black/50 text-sm">Салбар алга</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!editing && (
              <ul className="mt-2 text-xs text-black/70 grid grid-cols-2 gap-y-1">
                <li>{form.password.length >= 8 ? "✓" : "✗"} 8+ тэмдэгт</li>
                <li>
                  {/[A-Za-z]/.test(form.password) ? "✓" : "✗"} Үсэг агуулсан
                </li>
                <li>{/\d/.test(form.password) ? "✓" : "✗"} Тоо агуулсан</li>
              </ul>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="h-10 px-4 rounded-md bg-white border"
              >
                Болих
              </button>
              <button
                onClick={saveUser}
                className="h-10 px-5 rounded-md bg-[#5AA6FF] text-white disabled:opacity-50"
                disabled={
                  !activeTenantId || (!editing && (!form.email || !pwOk))
                }
              >
                {editing ? "Хадгалах" : "Үүсгэх"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
