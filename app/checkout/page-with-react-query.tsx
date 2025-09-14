"use client";

import { useState, useMemo } from "react";
import { 
  useCheckoutOrders, 
  useCreateCheckout, 
  useCreateCheckoutOrder,
  useProducts,
  useProductsByStore 
} from "@/lib/hooks";

type CheckoutItem = {
  variantId: string;
  name: string;
  price: number;
  qty: number;
  total: number;
};

export default function CheckoutPageWithReactQuery() {
  // State
  const [storeId, setStoreId] = useState<string>("");
  const [cart, setCart] = useState<CheckoutItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // React Query hooks
  const { 
    data: checkoutOrders, 
    isLoading: loadingOrders, 
    refetch: refetchOrders 
  } = useCheckoutOrders(storeId, 20, 0);

  const { 
    data: products, 
    isLoading: loadingProducts 
  } = storeId ? useProductsByStore(storeId) : useProducts();

  // Mutations
  const createCheckoutMutation = useCreateCheckout();
  const createOrderMutation = useCreateCheckoutOrder();

  // Computed values
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const availableProducts = useMemo(() => {
    if (!products?.items) return [];
    return products.items.filter((product: any) => 
      product.variants && product.variants.length > 0
    );
  }, [products]);

  // Handlers
  const addToCart = (productVariant: any) => {
    const existingItem = cart.find(item => item.variantId === productVariant.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.variantId === productVariant.id
          ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.price }
          : item
      ));
    } else {
      const newItem: CheckoutItem = {
        variantId: productVariant.id,
        name: `${productVariant.product?.name || ''} - ${productVariant.name || ''}`,
        price: productVariant.price || 0,
        qty: 1,
        total: productVariant.price || 0
      };
      setCart([...cart, newItem]);
    }
  };

  const removeFromCart = (variantId: string) => {
    setCart(cart.filter(item => item.variantId !== variantId));
  };

  const updateCartItemQty = (variantId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(variantId);
      return;
    }

    setCart(cart.map(item => 
      item.variantId === variantId
        ? { ...item, qty, total: qty * item.price }
        : item
    ));
  };

  const handleCheckout = async () => {
    if (!storeId || cart.length === 0) return;

    try {
      const orderData = {
        items: cart.map(item => ({
          variantId: item.variantId,
          qty: item.qty,
          price: item.price
        })),
        payments: [{
          method: 'CASH',
          amount: cartTotal
        }],
        store_id: storeId
      };

      await createOrderMutation.mutateAsync(orderData);
      
      // Clear cart after successful checkout
      setCart([]);
      
      // Refetch orders to show the new one
      refetchOrders();
      
      alert('Борлуулалт амжилттай бүртгэгдлээ!');
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Борлуулалт бүртгэхэд алдаа гарлаа!');
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Борлуулалт</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Selection */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Салбар сонгох</label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Салбар сонгоно уу</option>
              <option value="store1">Салбар 1</option>
              <option value="store2">Салбар 2</option>
            </select>
          </div>

          {loadingProducts ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold mb-3">Бараа сонгох</h2>
              {availableProducts.map((product: any) => (
                <div key={product.id} className="border rounded-lg p-3">
                  <h3 className="font-medium">{product.name}</h3>
                  <div className="mt-2 space-y-1">
                    {product.variants?.map((variant: any) => (
                      <div key={variant.id} className="flex justify-between items-center py-1">
                        <span className="text-sm">
                          {variant.name} - ₮{variant.price?.toLocaleString()}
                          {variant.qty && ` (${variant.qty}ш)`}
                        </span>
                        <button
                          onClick={() => addToCart({ ...variant, product })}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                          disabled={variant.qty === 0}
                        >
                          Нэмэх
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shopping Cart */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Сагс</h2>
          
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Сагс хоосон байна</p>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div key={item.variantId} className="bg-white p-3 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{item.name}</span>
                      <button
                        onClick={() => removeFromCart(item.variantId)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateCartItemQty(item.variantId, item.qty - 1)}
                          className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.qty}</span>
                        <button
                          onClick={() => updateCartItemQty(item.variantId, item.qty + 1)}
                          className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded text-sm"
                        >
                          +
                        </button>
                      </div>
                      
                      <span className="font-semibold">
                        ₮{item.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">Нийт дүн:</span>
                  <span className="font-bold text-lg">₮{cartTotal.toLocaleString()}</span>
                </div>
                
                <button
                  onClick={handleCheckout}
                  disabled={!storeId || cart.length === 0 || createOrderMutation.isPending}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  {createOrderMutation.isPending ? 'Боловсруулж байна...' : 'Төлбөр төлөх'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Сүүлийн борлуулалт</h2>
        
        {loadingOrders ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Огноо</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Дүн</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {checkoutOrders?.items?.map((order: any) => (
                  <tr key={order.id}>
                    <td className="border border-gray-300 px-4 py-2">{order.id}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      ₮{order.total?.toLocaleString() || '0'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <span className={`px-2 py-1 rounded text-sm ${
                        order.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={4} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      Борлуулалт байхгүй
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}