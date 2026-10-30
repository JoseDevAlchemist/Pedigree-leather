import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatPrice } from "@/lib/format";

export interface ReceiptOrder {
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_method: "delivery" | "pickup";
  delivery_address: string | null;
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  total: number;
  payment_method: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  items: {
    id: string;
    product_name: string;
    color_name: string;
    color_hex: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
}

const BROWN = "#5d4037";
const BROWN_DARK = "#3b2a24";
const GOLD = "#d4af37";
const CREAM = "#f5e9d9";
const MUTED = "#6e5b4c";
const BORDER = "#e2d3bf";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 48,
    backgroundColor: "#ffffff",
    color: BROWN_DARK,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: BROWN,
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    letterSpacing: 1.5,
    color: BROWN,
  },
  tagline: {
    marginTop: 4,
    fontSize: 8,
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: "uppercase",
  },
  receiptBadge: {
    backgroundColor: BROWN,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  receiptBadgeText: {
    color: CREAM,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 22,
    marginBottom: 24,
  },
  metaBlock: {
    flex: 1,
    paddingRight: 12,
  },
  metaLabel: {
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: BROWN_DARK,
  },
  metaValueSmall: {
    fontSize: 9,
    color: BROWN_DARK,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: BROWN,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: CREAM,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeadCell: {
    fontSize: 7,
    letterSpacing: 0.8,
    color: MUTED,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  colItem: { flex: 1 },
  colColour: { width: 110, flexDirection: "row", alignItems: "center" },
  colQty: { width: 40, textAlign: "right" },
  colPrice: { width: 85, textAlign: "right" },
  itemName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: BROWN_DARK,
  },
  itemSub: {
    marginTop: 2,
    fontSize: 8,
    color: MUTED,
  },
  colourDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 0.5,
    borderColor: "rgba(0, 0, 0, 0.13)",
  },
  cellText: {
    fontSize: 9,
    color: BROWN_DARK,
  },
  cellMuted: {
    fontSize: 9,
    color: MUTED,
  },
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  totals: {
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalValue: {
    fontSize: 9,
    color: BROWN_DARK,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: BROWN,
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: BROWN_DARK,
  },
  grandTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: BROWN,
  },
  deliveryBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#faf5ee",
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
  },
});

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function paymentLabel(method: string | null): string {
  if (!method) return "Not set";
  if (method === "mpesa") return "M-Pesa";
  if (method === "mpesa_manual") return "M-Pesa Till";
  if (method === "card") return "Card";
  if (method === "pay_on_delivery") return "Pay on delivery";
  return method.replace(/_/g, " ");
}

export function ReceiptPDF({ order }: { order: ReceiptOrder }) {
  return (
    <Document
      title={`Pedigree Leather Receipt ${order.order_number}`}
      author="Pedigree Leather"
      subject={`Receipt for order ${order.order_number}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>PEDIGREE LEATHER</Text>
            <Text style={styles.tagline}>Handcrafted in Nairobi</Text>
          </View>
          <View style={styles.receiptBadge}>
            <Text style={styles.receiptBadgeText}>Receipt</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Order number</Text>
            <Text style={styles.metaValue}>{order.order_number}</Text>
            <Text style={styles.metaValueSmall}>
              Placed {formatDate(order.created_at)}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Customer</Text>
            <Text style={styles.metaValue}>{order.customer_name}</Text>
            <Text style={styles.metaValueSmall}>{order.customer_phone}</Text>
            {order.customer_email ? (
              <Text style={styles.metaValueSmall}>{order.customer_email}</Text>
            ) : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Payment</Text>
            <Text style={styles.metaValue}>{paymentLabel(order.payment_method)}</Text>
            <Text style={styles.metaValueSmall}>
              {order.paid_at ? `Paid ${formatDate(order.paid_at)}` : "Payment pending"}
            </Text>
            {order.payment_reference ? (
              <Text style={styles.metaValueSmall}>
                Ref {order.payment_reference}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, styles.colItem]}>Item</Text>
            <Text style={[styles.tableHeadCell, styles.colColour]}>Colour</Text>
            <Text style={[styles.tableHeadCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeadCell, styles.colPrice]}>Price</Text>
          </View>

          {order.items.map((item) => (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <View style={styles.colItem}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemSub}>
                  {formatPrice(item.unit_price)} each
                </Text>
              </View>
              <View style={styles.colColour}>
                <View
                  style={[styles.colourDot, { backgroundColor: item.color_hex }]}
                />
                <Text style={styles.cellMuted}>{item.color_name}</Text>
              </View>
              <Text style={[styles.cellText, styles.colQty]}>
                {item.quantity}
              </Text>
              <Text style={[styles.cellText, styles.colPrice]}>
                {formatPrice(item.line_total)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatPrice(order.subtotal)}</Text>
            </View>
            {order.discount_total > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={styles.totalValue}>
                  -{formatPrice(order.discount_total)}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {order.delivery_method === "pickup" ? "Pickup" : "Delivery"}
              </Text>
              <Text style={styles.totalValue}>
                {order.delivery_fee === 0
                  ? "Free"
                  : formatPrice(order.delivery_fee)}
              </Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatPrice(order.total)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.deliveryBox}>
          <Text style={styles.metaLabel}>
            {order.delivery_method === "pickup" ? "Pickup" : "Delivery details"}
          </Text>
          <Text style={styles.cellText}>
            {order.delivery_method === "pickup"
              ? "Collect from Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi."
              : order.delivery_address || "Address provided at checkout."}
          </Text>
        </View>

        <Text style={styles.footer}>
          Thank you for choosing Pedigree Leather. Questions? WhatsApp or call
          us on +254 143 354 741.
        </Text>
      </Page>
    </Document>
  );
}
