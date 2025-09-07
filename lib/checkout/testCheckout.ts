// Test script for checkout API functions
// Usage: Run this in your browser console or create a test page

async function testCheckoutAPI() {
  console.log("=== Testing Checkout API Functions ===");

  try {
    // Test 1: Get recent orders
    console.log("\n1. Testing getCheckoutOrders...");
    const orders = await window.getCheckoutOrders();
    console.log("Recent orders:", orders);

    if (orders && orders.items.length > 0) {
      const firstOrderId = orders.items[0].id;

      // Test 2: Get specific order details
      console.log("\n2. Testing getCheckoutOrder...");
      const orderDetail = await window.getCheckoutOrder(firstOrderId);
      console.log("Order detail:", orderDetail);
    }

    // Test 3: Create a test order (commented out to avoid creating real orders)
    /*
    console.log("\n3. Testing createCheckoutOrder...");
    const testItems = [
      {
        id: "test-variant-id",
        name: "Test Product",
        qty: 1,
        price: 10000,
        imgPath: "/default.png"
      }
    ];
    const testPayments = [
      {
        method: "cash",
        amount: 10000
      }
    ];
    
    const newOrder = await window.createCheckoutOrder(testItems, testPayments);
    console.log("Created order:", newOrder);
    */

    console.log("\n=== Test completed ===");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Export functions to window for testing
if (typeof window !== "undefined") {
  // Import your checkout API functions here
  // window.getCheckoutOrders = getCheckoutOrders;
  // window.getCheckoutOrder = getCheckoutOrder;
  // window.createCheckoutOrder = createCheckoutOrder;

  // Then call testCheckoutAPI() in console
  window.testCheckoutAPI = testCheckoutAPI;
}

export { testCheckoutAPI };
