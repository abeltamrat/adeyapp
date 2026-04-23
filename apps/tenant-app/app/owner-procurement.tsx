import { ApiError } from "@adeyapp/api-client";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { tenantApi } from "../lib/api";

type BranchSetupSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listBranches>>[number];
type SupplierSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listSuppliers>>[number];
type PurchaseOrderSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listPurchaseOrders>>[number];

export default function OwnerProcurementScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContactName, setSupplierContactName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [purchaseUnitCost, setPurchaseUnitCost] = useState("0");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingPurchaseOrder, setCreatingPurchaseOrder] = useState(false);
  const [receivingPurchaseOrder, setReceivingPurchaseOrder] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? branches[0],
    [branches, selectedBranchId]
  );
  const selectedPurchaseOrder = purchaseOrders.find((order) => order.id === selectedPurchaseOrderId) ?? purchaseOrders[0];

  useEffect(() => {
    let active = true;

    async function loadProcurement() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        if (!active) {
          return;
        }

        const branchId = selectedBranchId || nextBranches[0]?.id || "";
        const [nextSuppliers, nextPurchaseOrders] = branchId
          ? await Promise.all([
              tenantApi.tenantManagement.listSuppliers({ branchId }),
              tenantApi.tenantManagement.listPurchaseOrders({ branchId })
            ])
          : [[], []];

        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setSuppliers(nextSuppliers);
        setPurchaseOrders(nextPurchaseOrders);
        setSelectedBranchId(branchId);
        setSelectedSupplierId((current) => current || nextSuppliers[0]?.id || "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load procurement data right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProcurement();

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  useEffect(() => {
    if (!selectedBranch) {
      setSelectedProductId("");
      return;
    }

    setSelectedProductId((current) =>
      current && selectedBranch.products.some((product) => product.id === current)
        ? current
        : selectedBranch.products[0]?.id || ""
    );
  }, [selectedBranch]);

  async function refreshProcurement(branchId: string) {
    const [nextBranches, nextSuppliers, nextPurchaseOrders] = await Promise.all([
      tenantApi.tenantManagement.listBranches(),
      tenantApi.tenantManagement.listSuppliers({ branchId }),
      tenantApi.tenantManagement.listPurchaseOrders({ branchId })
    ]);
    setBranches(nextBranches);
    setSuppliers(nextSuppliers);
    setPurchaseOrders(nextPurchaseOrders);
    setSelectedSupplierId((current) => current || nextSuppliers[0]?.id || "");
    setSelectedPurchaseOrderId((current) => current || nextPurchaseOrders[0]?.id || "");
  }

  async function submitSupplier() {
    if (!selectedBranch || !supplierName.trim()) {
      setMessage("Choose a branch and enter the supplier name first.");
      return;
    }

    setCreatingSupplier(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createSupplier({
        branchId: selectedBranch.id,
        name: supplierName,
        contactName: supplierContactName || undefined,
        phone: supplierPhone || undefined,
        email: supplierEmail || undefined
      });
      setSupplierName("");
      setSupplierContactName("");
      setSupplierPhone("");
      setSupplierEmail("");
      setMessage("Supplier created.");
      await refreshProcurement(selectedBranch.id);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the supplier right now.");
      }
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function submitPurchaseOrder() {
    if (!selectedBranch || !selectedSupplierId || !selectedProductId) {
      setMessage("Choose the branch, supplier, and product first.");
      return;
    }

    setCreatingPurchaseOrder(true);
    setMessage(null);

    try {
      const created = await tenantApi.tenantManagement.createPurchaseOrder({
        branchId: selectedBranch.id,
        supplierId: selectedSupplierId,
        note: purchaseNote.trim() || undefined,
        items: [
          {
            productId: selectedProductId,
            quantityOrdered: Number(purchaseQuantity || "0"),
            unitCost: Number(purchaseUnitCost || "0")
          }
        ]
      });
      setPurchaseNote("");
      setPurchaseQuantity("1");
      setPurchaseUnitCost("0");
      setSelectedPurchaseOrderId(created.id);
      setMessage("Purchase order created.");
      await refreshProcurement(selectedBranch.id);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the purchase order right now.");
      }
    } finally {
      setCreatingPurchaseOrder(false);
    }
  }

  async function receivePurchaseOrder() {
    if (!selectedPurchaseOrder || !selectedPurchaseOrder.items.length) {
      setMessage("Choose a purchase order with items first.");
      return;
    }

    setReceivingPurchaseOrder(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.receivePurchaseOrder(selectedPurchaseOrder.id, {
        note: "Received from procurement screen",
        items: selectedPurchaseOrder.items.map((item) => ({
          purchaseOrderItemId: item.id,
          quantityReceived: Number(receiveQuantity || "0")
        }))
      });
      setReceiveQuantity("1");
      setMessage("Purchase order receipt saved and inventory updated.");
      if (selectedBranch) {
        await refreshProcurement(selectedBranch.id);
      }
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to receive the purchase order right now.");
      }
    } finally {
      setReceivingPurchaseOrder(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Inventory procurement</Text>
          <Text style={styles.copy}>
            Track suppliers, raise purchase orders, and receive stock back into branch inventory.
          </Text>

          {loading ? (
            <ActivityIndicator color="#1D5C63" />
          ) : (
            <>
              <View style={styles.branchList}>
                {branches.map((branch) => (
                  <Pressable
                    key={branch.id}
                    onPress={() => setSelectedBranchId(branch.id)}
                    style={[
                      styles.branchChip,
                      branch.id === selectedBranch?.id ? styles.branchChipActive : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.branchChipText,
                        branch.id === selectedBranch?.id ? styles.branchChipTextActive : null
                      ]}
                    >
                      {branch.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {selectedBranch ? (
                <>
                  <Text style={styles.sectionTitle}>Suppliers</Text>
                  <View style={styles.listCard}>
                    {suppliers.length ? (
                      suppliers.map((supplier) => (
                        <Pressable
                          key={supplier.id}
                          onPress={() => setSelectedSupplierId(supplier.id)}
                          style={[
                            styles.selectorRow,
                            supplier.id === selectedSupplierId ? styles.selectorRowActive : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorTitle,
                              supplier.id === selectedSupplierId ? styles.selectorTitleActive : null
                            ]}
                          >
                            {supplier.name}
                          </Text>
                          <Text
                            style={[
                              styles.selectorMeta,
                              supplier.id === selectedSupplierId ? styles.selectorMetaActive : null
                            ]}
                          >
                            {supplier.contactName || supplier.phone || supplier.email || "No contact saved yet"}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No suppliers saved for this branch yet.</Text>
                    )}
                  </View>
                  <TextInput
                    onChangeText={setSupplierName}
                    placeholder="Supplier name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={supplierName}
                  />
                  <TextInput
                    onChangeText={setSupplierContactName}
                    placeholder="Contact name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={supplierContactName}
                  />
                  <TextInput
                    onChangeText={setSupplierPhone}
                    placeholder="Phone"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={supplierPhone}
                  />
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setSupplierEmail}
                    placeholder="Email"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={supplierEmail}
                  />
                  <Pressable disabled={creatingSupplier} onPress={() => void submitSupplier()} style={styles.primaryButton}>
                    {creatingSupplier ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create supplier</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Create purchase order</Text>
                  <View style={styles.selectorList}>
                    {selectedBranch.products.length ? (
                      selectedBranch.products.map((product) => (
                        <Pressable
                          key={product.id}
                          onPress={() => setSelectedProductId(product.id)}
                          style={[
                            styles.selectorRow,
                            product.id === selectedProductId ? styles.selectorRowActive : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorTitle,
                              product.id === selectedProductId ? styles.selectorTitleActive : null
                            ]}
                          >
                            {product.name}
                          </Text>
                          <Text
                            style={[
                              styles.selectorMeta,
                              product.id === selectedProductId ? styles.selectorMetaActive : null
                            ]}
                          >
                            {product.sku} | Current stock {product.inventoryItem?.quantityOnHand ?? "0"}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No branch products available for procurement yet.</Text>
                    )}
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setPurchaseQuantity}
                    placeholder="Quantity ordered"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={purchaseQuantity}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setPurchaseUnitCost}
                    placeholder="Unit cost"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={purchaseUnitCost}
                  />
                  <TextInput
                    onChangeText={setPurchaseNote}
                    placeholder="Purchase note"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={purchaseNote}
                  />
                  <Pressable
                    disabled={creatingPurchaseOrder}
                    onPress={() => void submitPurchaseOrder()}
                    style={styles.primaryButton}
                  >
                    {creatingPurchaseOrder ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create purchase order</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Open and recent purchase orders</Text>
                  <View style={styles.listCard}>
                    {purchaseOrders.length ? (
                      purchaseOrders.map((order) => (
                        <Pressable
                          key={order.id}
                          onPress={() => setSelectedPurchaseOrderId(order.id)}
                          style={[
                            styles.itemCard,
                            order.id === selectedPurchaseOrder?.id ? styles.itemCardActive : null
                          ]}
                        >
                          <Text style={styles.itemTitle}>
                            {order.poNumber} | {order.supplierName}
                          </Text>
                          <Text style={styles.itemMeta}>
                            {order.status} | {order.items.length} line(s)
                          </Text>
                          {order.items.map((item) => (
                            <Text key={item.id} style={styles.itemMeta}>
                              {item.productName}: {item.quantityReceived}/{item.quantityOrdered} received
                            </Text>
                          ))}
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No purchase orders created for this branch yet.</Text>
                    )}
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setReceiveQuantity}
                    placeholder="Receive quantity per line"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={receiveQuantity}
                  />
                  <Pressable
                    disabled={receivingPurchaseOrder || !selectedPurchaseOrder}
                    onPress={() => void receivePurchaseOrder()}
                    style={styles.primaryButton}
                  >
                    {receivingPurchaseOrder ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Receive selected purchase order</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <Text style={styles.emptyText}>No branch found for the active workspace.</Text>
              )}
            </>
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F3EC"
  },
  content: {
    padding: 24
  },
  card: {
    backgroundColor: "#FFF9F1",
    borderRadius: 24,
    padding: 24,
    gap: 12
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#1D5C63",
    fontSize: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    color: "#596467"
  },
  branchList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  branchChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7CEC0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  branchChipActive: {
    backgroundColor: "#1D5C63",
    borderColor: "#1D5C63"
  },
  branchChipText: {
    color: "#1D5C63",
    fontWeight: "600"
  },
  branchChipTextActive: {
    color: "#FFFFFF"
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  listCard: {
    gap: 8
  },
  selectorList: {
    gap: 8
  },
  selectorRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 12,
    gap: 4
  },
  selectorRowActive: {
    backgroundColor: "#1D5C63",
    borderColor: "#1D5C63"
  },
  selectorTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  selectorTitleActive: {
    color: "#FFFFFF"
  },
  selectorMeta: {
    color: "#596467",
    fontSize: 13
  },
  selectorMetaActive: {
    color: "#D9F0EE"
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    color: "#1E1E1E",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 12,
    gap: 4
  },
  itemCardActive: {
    borderColor: "#1D5C63",
    backgroundColor: "#F2FAFA"
  },
  itemTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  itemMeta: {
    color: "#596467",
    fontSize: 13
  },
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
