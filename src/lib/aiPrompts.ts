import { RetailAIContext }
from './aiContext';

export const buildBusinessPrompt = (
  question: string,
  context: RetailAIContext
) => {

  return `
You are an advanced AI Retail Business Advisor.

Analyze the supermarket intelligently.

BUSINESS METRICS:
- Revenue: ₹${context.businessMetrics.totalRevenue}
- Orders: ${context.businessMetrics.totalOrders}
- Average Order Value: ₹${context.businessMetrics.averageOrderValue}

LOW STOCK ITEMS:
${context.lowStock
  .map(
    (item) =>
      `- ${item.item_name}: ${item.quantity} left`
  )
  .join('\n')}

FRESHNESS ALERTS:
${context.freshnessAlerts
  .map(
    (item) =>
      `- ${item.item_name}: freshness score ${item.freshness_score}`
  )
  .join('\n')}

SUPPLIERS:
${context.supplierData
  .map(
    (supplier) =>
      `- ${supplier.name}: ${supplier.category}`
  )
  .join('\n')}

RECENT SALES:
${context.recentSales.length}

USER QUESTION:
${question}

Provide:
- business insights
- inventory recommendations
- supplier suggestions
- profit optimization
- waste reduction strategies
- operational intelligence
`;
};

export const buildCustomerPrompt = (
  question: string,
  context: RetailAIContext
) => {

  return `
You are an AI Shopping Assistant.

AVAILABLE PRODUCTS:

${context.inventory
  .slice(0, 100)
  .map(
    (item) =>
      `
Product: ${item.item_name}
Price: ₹${item.unit_price}
Stock: ${item.quantity}
Freshness: ${item.freshness_score || 'N/A'}
Category: ${item.category}
`
  )
  .join('\n')}

USER QUESTION:
${question}

Provide:
- shopping recommendations
- healthy options
- budget optimization
- recipe suggestions
- freshness-aware suggestions
- combo recommendations
`;
};