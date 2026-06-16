function orderProduct(productName, price) {
  const email = 'your-email@example.com'; // Change this to your actual email
  const subject = `Product Order: ${productName}`;
  const body = `I would like to order the following product:\n\nProduct: ${productName}\nPrice: ${price}\n\nPlease let me know the next steps for completing this order.`;
  
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
