import { ApiError } from "@adeyapp/api-client";
import { useEffect, useState } from "react";
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
import type { EmployeeSummary as EmployeeSummaryType } from "@adeyapp/types";

type BranchSetupSummary = Awaited<
  ReturnType<typeof tenantApi.tenantManagement.listBranches>
>[number];
type EmployeeSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listEmployees>>[number];
type ProductSummary = BranchSetupSummary["products"][number];

const STAFF_ROLE_OPTIONS: EmployeeSummaryType["roleType"][] = ["employee", "manager", "receptionist"];

export default function OwnerSetupScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [modules, setModules] = useState<
    Awaited<ReturnType<typeof tenantApi.tenantManagement.getModules>> | null
  >(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submittingRoom, setSubmittingRoom] = useState(false);
  const [submittingService, setSubmittingService] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submittingEmployee, setSubmittingEmployee] = useState(false);
  const [updatingRoleEmployeeId, setUpdatingRoleEmployeeId] = useState<string | null>(null);
  const [updatingCreditEmployeeId, setUpdatingCreditEmployeeId] = useState<string | null>(null);
  const [updatingStatusEmployeeId, setUpdatingStatusEmployeeId] = useState<string | null>(null);
  const [updatingInventoryId, setUpdatingInventoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomType, setRoomType] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [servicePrice, setServicePrice] = useState("0");
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productUnitPrice, setProductUnitPrice] = useState("0");
  const [productCostPrice, setProductCostPrice] = useState("");
  const [productStartingQuantity, setProductStartingQuantity] = useState("0");
  const [productReorderLevel, setProductReorderLevel] = useState("");
  const [productIsRetail, setProductIsRetail] = useState(true);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [inventoryQuantity, setInventoryQuantity] = useState("0");
  const [inventoryReorderLevel, setInventoryReorderLevel] = useState("");
  const [inventoryNote, setInventoryNote] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeRoleType, setEmployeeRoleType] = useState<EmployeeSummaryType["roleType"]>("employee");
  const [staffActionNote, setStaffActionNote] = useState("");
  const [terminationChecklist, setTerminationChecklist] = useState({
    finalSettlementConfirmed: false,
    accessRevokedConfirmed: false,
    assetRecoveryConfirmed: false,
    creditReviewedConfirmed: false
  });

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        const nextModules = await tenantApi.tenantManagement.getModules();
        const defaultBranchId = nextBranches[0]?.id;
        const nextEmployees = defaultBranchId
          ? await tenantApi.tenantManagement.listEmployees({ branchId: defaultBranchId })
          : [];
        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setEmployees(nextEmployees);
        setModules(nextModules);
        setSelectedBranchId((current) => current || nextBranches[0]?.id || "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load branch setup details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBranches();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadEmployeesForBranch() {
      if (!selectedBranchId) {
        if (active) {
          setEmployees([]);
        }
        return;
      }

      try {
        const nextEmployees = await tenantApi.tenantManagement.listEmployees({
          branchId: selectedBranchId
        });
        if (active) {
          setEmployees(nextEmployees);
        }
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load employees for the selected branch.");
        }
      }
    }

    void loadEmployeesForBranch();

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const selectedProduct = selectedBranch?.products.find(
    (product) => product.inventoryItem?.id === selectedInventoryId
  );

  useEffect(() => {
    if (!selectedBranch?.products.length) {
      setSelectedInventoryId("");
      setInventoryQuantity("0");
      setInventoryReorderLevel("");
      return;
    }

    const fallbackProduct =
      selectedBranch.products.find((product) => product.inventoryItem?.id === selectedInventoryId) ??
      selectedBranch.products[0];

    const nextInventoryId = fallbackProduct.inventoryItem?.id ?? "";
    setSelectedInventoryId(nextInventoryId);
    setInventoryQuantity(fallbackProduct.inventoryItem?.quantityOnHand ?? "0");
    setInventoryReorderLevel(fallbackProduct.inventoryItem?.reorderLevel ?? "");
  }, [selectedBranch, selectedInventoryId]);

  async function refreshBranches() {
    const nextBranches = await tenantApi.tenantManagement.listBranches();
    const nextModules = await tenantApi.tenantManagement.getModules();
    const branchId = selectedBranchId || nextBranches[0]?.id || "";
    const nextEmployees = branchId
      ? await tenantApi.tenantManagement.listEmployees({ branchId })
      : [];
    setBranches(nextBranches);
    setEmployees(nextEmployees);
    setModules(nextModules);
    setSelectedBranchId((current) => current || nextBranches[0]?.id || "");
  }

  async function submitRoom() {
    if (!selectedBranch || !roomName.trim() || !roomCode.trim()) {
      setMessage("Choose a branch and enter the room basics first.");
      return;
    }

    setSubmittingRoom(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createRoom({
        branchId: selectedBranch.id,
        name: roomName,
        code: roomCode,
        roomType: roomType || undefined
      });
      setRoomName("");
      setRoomCode("");
      setRoomType("");
      setMessage("Room created successfully.");
      await refreshBranches();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the room right now.");
      }
    } finally {
      setSubmittingRoom(false);
    }
  }

  async function submitProduct() {
    if (!selectedBranch || !productName.trim() || !productSku.trim() || !productUnitPrice.trim()) {
      setMessage("Choose a branch and complete the product basics first.");
      return;
    }

    setSubmittingProduct(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createProduct({
        branchId: selectedBranch.id,
        name: productName,
        sku: productSku,
        description: productDescription || undefined,
        unitPrice: Number(productUnitPrice),
        costPrice: productCostPrice.trim() ? Number(productCostPrice) : undefined,
        startingQuantity: productStartingQuantity.trim() ? Number(productStartingQuantity) : 0,
        reorderLevel: productReorderLevel.trim() ? Number(productReorderLevel) : undefined,
        isRetail: productIsRetail
      });
      setProductName("");
      setProductSku("");
      setProductDescription("");
      setProductUnitPrice("0");
      setProductCostPrice("");
      setProductStartingQuantity("0");
      setProductReorderLevel("");
      setProductIsRetail(true);
      setMessage("Product created successfully.");
      await refreshBranches();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the product right now.");
      }
    } finally {
      setSubmittingProduct(false);
    }
  }

  function loadInventoryAdjustment(product: ProductSummary) {
    if (!product.inventoryItem) {
      return;
    }

    setSelectedInventoryId(product.inventoryItem.id);
    setInventoryQuantity(product.inventoryItem.quantityOnHand);
    setInventoryReorderLevel(product.inventoryItem.reorderLevel ?? "");
    setInventoryNote("");
  }

  async function submitInventoryAdjustment() {
    if (!selectedInventoryId || !inventoryQuantity.trim()) {
      setMessage("Choose a product and enter the current stock count first.");
      return;
    }

    setUpdatingInventoryId(selectedInventoryId);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.adjustInventory(selectedInventoryId, {
        quantityOnHand: Number(inventoryQuantity),
        reorderLevel: inventoryReorderLevel.trim() ? Number(inventoryReorderLevel) : undefined,
        note: inventoryNote.trim() || undefined
      });
      setInventoryNote("");
      setMessage("Inventory updated successfully.");
      await refreshBranches();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to adjust inventory right now.");
      }
    } finally {
      setUpdatingInventoryId(null);
    }
  }

  async function submitService() {
    if (
      !selectedBranch ||
      !serviceName.trim() ||
      !serviceCode.trim() ||
      !serviceDuration.trim() ||
      !servicePrice.trim()
    ) {
      setMessage("Choose a branch and complete the service fields first.");
      return;
    }

    setSubmittingService(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createService({
        branchId: selectedBranch.id,
        name: serviceName,
        code: serviceCode,
        durationMinutes: Number(serviceDuration),
        price: Number(servicePrice)
      });
      setServiceName("");
      setServiceCode("");
      setServiceDuration("60");
      setServicePrice("0");
      setMessage("Service created successfully.");
      await refreshBranches();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the service right now.");
      }
    } finally {
      setSubmittingService(false);
    }
  }

  async function submitEmployee() {
    if (!selectedBranch || !employeeEmail.trim() || !employeePassword.trim() || !employeeCode.trim()) {
      setMessage("Choose a branch and complete the employee email, password, and code first.");
      return;
    }

    setSubmittingEmployee(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createEmployee({
        branchId: selectedBranch.id,
        email: employeeEmail,
        password: employeePassword,
        employeeCode: employeeCode,
        phone: employeePhone || undefined,
        roleType: employeeRoleType
      });
      setEmployeeEmail("");
      setEmployeePassword("");
      setEmployeeCode("");
      setEmployeePhone("");
      setEmployeeRoleType("employee");
      setMessage("Employee created successfully.");
      await refreshBranches();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the employee right now.");
      }
    } finally {
      setSubmittingEmployee(false);
    }
  }

  async function updateEmployeeRole(employeeId: string, roleType: EmployeeSummaryType["roleType"]) {
    setUpdatingRoleEmployeeId(employeeId);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updateEmployeeRole(employeeId, { roleType });
      setEmployees((current) =>
        current.map((employee) => (employee.id === updated.id ? updated : employee))
      );
      setMessage(`Role updated to ${roleType}.`);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update the staff role right now.");
      }
    } finally {
      setUpdatingRoleEmployeeId(null);
    }
  }

  async function updateEmployeeStatus(
    employee: EmployeeSummary,
    employmentStatus: EmployeeSummaryType["employmentStatus"]
  ) {
    if (employmentStatus === "terminated" && !staffActionNote.trim()) {
      setMessage("Add a termination note before ending a staff account.");
      return;
    }

    setUpdatingStatusEmployeeId(employee.id);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updateEmployeeStatus(employee.id, {
        employmentStatus,
        note: staffActionNote.trim() || undefined,
        ...terminationChecklist
      });
      setEmployees((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      setMessage(
        `${employee.employeeCode || employee.email || "Employee"} is now ${employmentStatus.replace("_", " ")}.`
      );
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update employee status right now.");
      }
    } finally {
      setUpdatingStatusEmployeeId(null);
    }
  }

  async function updateEmployeeCreditEligibility(employee: EmployeeSummary, creditEligible: boolean) {
    if (modules && !modules.employeeCredit) {
      setMessage("Employee credit is disabled for this workspace.");
      return;
    }

    setUpdatingCreditEmployeeId(employee.id);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updateEmployeeCreditEligibility(employee.id, {
        creditEligible,
        note: staffActionNote.trim() || undefined
      });
      setEmployees((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      setMessage(
        `${employee.employeeCode || employee.email || "Employee"} credit access is now ${
          creditEligible ? "enabled" : "disabled"
        }.`
      );
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update employee credit eligibility right now.");
      }
    } finally {
      setUpdatingCreditEmployeeId(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner Setup</Text>
          <Text style={styles.title}>Prepare your branch for bookings</Text>
          <Text style={styles.copy}>
            Add treatment rooms and services so the workspace becomes booking-ready.
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
                  <Text style={styles.sectionTitle}>Rooms in {selectedBranch.name}</Text>
                  <View style={styles.listCard}>
                    {selectedBranch.rooms.length ? (
                      selectedBranch.rooms.map((room) => (
                        <Text key={room.id} style={styles.listItem}>
                          {room.name} ({room.code}){room.roomType ? ` • ${room.roomType}` : ""}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No rooms added yet.</Text>
                    )}
                  </View>

                  <TextInput
                    onChangeText={setRoomName}
                    placeholder="Room name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={roomName}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setRoomCode}
                    placeholder="Room code"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={roomCode}
                  />
                  <TextInput
                    onChangeText={setRoomType}
                    placeholder="Room type (optional)"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={roomType}
                  />
                  <Pressable disabled={submittingRoom} onPress={submitRoom} style={styles.primaryButton}>
                    {submittingRoom ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add room</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Services in {selectedBranch.name}</Text>
                  <View style={styles.listCard}>
                    {selectedBranch.services.length ? (
                      selectedBranch.services.map((service) => (
                        <Text key={service.id} style={styles.listItem}>
                          {service.name} ({service.code}) • {service.durationMinutes} min • {service.price}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No services added yet.</Text>
                    )}
                  </View>

                  <TextInput
                    onChangeText={setServiceName}
                    placeholder="Service name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={serviceName}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setServiceCode}
                    placeholder="Service code"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={serviceCode}
                  />
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={setServiceDuration}
                    placeholder="Duration in minutes"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={serviceDuration}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setServicePrice}
                    placeholder="Price"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={servicePrice}
                  />
                  <Pressable
                    disabled={submittingService}
                    onPress={submitService}
                    style={styles.primaryButton}
                  >
                    {submittingService ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add service</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Products in {selectedBranch.name}</Text>
                  <View style={styles.listCard}>
                    {selectedBranch.products.length ? (
                      selectedBranch.products.map((product) => (
                        <Pressable
                          key={product.id}
                          onPress={() => loadInventoryAdjustment(product)}
                          style={[
                            styles.productCard,
                            product.inventoryItem?.id === selectedInventoryId
                              ? styles.productCardSelected
                              : null
                          ]}
                        >
                          <Text style={styles.employeeTitle}>
                            {product.name} ({product.sku})
                          </Text>
                          <Text style={styles.employeeMeta}>
                            Price: {product.unitPrice}
                            {product.costPrice ? ` | Cost: ${product.costPrice}` : ""}
                            {product.isRetail ? " | Retail" : " | Internal"}
                          </Text>
                          <Text style={styles.employeeMeta}>
                            Stock: {product.inventoryItem?.quantityOnHand ?? "0"}
                            {product.inventoryItem?.reorderLevel
                              ? ` | Reorder at: ${product.inventoryItem.reorderLevel}`
                              : ""}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No products added yet.</Text>
                    )}
                  </View>

                  <TextInput
                    onChangeText={setProductName}
                    placeholder="Product name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productName}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setProductSku}
                    placeholder="Product SKU"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productSku}
                  />
                  <TextInput
                    onChangeText={setProductDescription}
                    placeholder="Description (optional)"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productDescription}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setProductUnitPrice}
                    placeholder="Unit price"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productUnitPrice}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setProductCostPrice}
                    placeholder="Cost price (optional)"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productCostPrice}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setProductStartingQuantity}
                    placeholder="Starting quantity"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productStartingQuantity}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setProductReorderLevel}
                    placeholder="Reorder level (optional)"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={productReorderLevel}
                  />
                  <View style={styles.roleRow}>
                    <Pressable
                      onPress={() => setProductIsRetail(true)}
                      style={[styles.roleChip, productIsRetail ? styles.roleChipActive : null]}
                    >
                      <Text
                        style={[styles.roleChipText, productIsRetail ? styles.roleChipTextActive : null]}
                      >
                        Retail
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setProductIsRetail(false)}
                      style={[styles.roleChip, !productIsRetail ? styles.roleChipActive : null]}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          !productIsRetail ? styles.roleChipTextActive : null
                        ]}
                      >
                        Internal use
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    disabled={submittingProduct}
                    onPress={submitProduct}
                    style={styles.primaryButton}
                  >
                    {submittingProduct ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add product</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Inventory count in {selectedBranch.name}</Text>
                  <Text style={styles.copy}>
                    Choose a product above, then save the latest stock count and reorder threshold.
                  </Text>
                  <TextInput
                    editable={Boolean(selectedProduct)}
                    keyboardType="decimal-pad"
                    onChangeText={setInventoryQuantity}
                    placeholder="Quantity on hand"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={inventoryQuantity}
                  />
                  <TextInput
                    editable={Boolean(selectedProduct)}
                    keyboardType="decimal-pad"
                    onChangeText={setInventoryReorderLevel}
                    placeholder="Reorder level"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={inventoryReorderLevel}
                  />
                  <TextInput
                    editable={Boolean(selectedProduct)}
                    onChangeText={setInventoryNote}
                    placeholder="Adjustment note (optional)"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={inventoryNote}
                  />
                  <Pressable
                    disabled={!selectedProduct || updatingInventoryId === selectedInventoryId}
                    onPress={submitInventoryAdjustment}
                    style={[
                      styles.primaryButton,
                      !selectedProduct ? styles.roleChipDisabled : null
                    ]}
                  >
                    {updatingInventoryId === selectedInventoryId ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Save inventory count</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Employees in {selectedBranch.name}</Text>
                  <TextInput
                    onChangeText={setStaffActionNote}
                    placeholder="Staff action note"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={staffActionNote}
                  />
                  <View style={styles.roleRow}>
                    {[
                      { key: "finalSettlementConfirmed", label: "Final settlement" },
                      { key: "accessRevokedConfirmed", label: "Access revoked" },
                      { key: "assetRecoveryConfirmed", label: "Assets recovered" },
                      { key: "creditReviewedConfirmed", label: "Credit reviewed" }
                    ].map((item) => (
                      <Pressable
                        key={item.key}
                        onPress={() =>
                          setTerminationChecklist((current) => ({
                            ...current,
                            [item.key]: !current[item.key as keyof typeof current]
                          }))
                        }
                        style={[
                          styles.roleChip,
                          terminationChecklist[item.key as keyof typeof terminationChecklist]
                            ? styles.roleChipActive
                            : null
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleChipText,
                            terminationChecklist[item.key as keyof typeof terminationChecklist]
                              ? styles.roleChipTextActive
                              : null
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.listCard}>
                    {employees.length ? (
                      employees.map((employee) => (
                        <View key={employee.id} style={styles.employeeCard}>
                          <Text style={styles.employeeTitle}>
                            {employee.employeeCode} - {employee.email}
                          </Text>
                          <Text style={styles.employeeMeta}>
                            Current role: {employee.roleType} | Status: {employee.employmentStatus}
                          </Text>
                          <Text style={styles.employeeMeta}>
                            Credit eligible: {employee.creditEligible ? "Yes" : "No"}
                          </Text>
                          <View style={styles.roleRow}>
                            {STAFF_ROLE_OPTIONS.map((role) => (
                              <Pressable
                                key={`${employee.id}-${role}`}
                                onPress={() => void updateEmployeeRole(employee.id, role)}
                                disabled={updatingRoleEmployeeId === employee.id}
                                style={[
                                  styles.roleChip,
                                  employee.roleType === role ? styles.roleChipActive : null,
                                  updatingRoleEmployeeId === employee.id ? styles.roleChipDisabled : null
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roleChipText,
                                    employee.roleType === role ? styles.roleChipTextActive : null
                                  ]}
                                >
                                  {role}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <View style={styles.roleRow}>
                            <Pressable
                              onPress={() => void updateEmployeeCreditEligibility(employee, !employee.creditEligible)}
                              disabled={
                                updatingCreditEmployeeId === employee.id || (modules ? !modules.employeeCredit : false)
                              }
                              style={[
                                styles.roleChip,
                                employee.creditEligible ? styles.roleChipActive : null,
                                updatingCreditEmployeeId === employee.id || (modules ? !modules.employeeCredit : false)
                                  ? styles.roleChipDisabled
                                  : null
                              ]}
                            >
                              <Text
                                style={[
                                  styles.roleChipText,
                                  employee.creditEligible ? styles.roleChipTextActive : null
                                ]}
                              >
                                {employee.creditEligible ? "Disable credit" : "Enable credit"}
                              </Text>
                            </Pressable>
                          </View>
                          {modules && !modules.employeeCredit ? (
                            <Text style={styles.employeeMeta}>Employee credit module is disabled by superadmin.</Text>
                          ) : null}
                          <View style={styles.roleRow}>
                            {employee.employmentStatus !== "active" ? (
                              <Pressable
                                onPress={() => void updateEmployeeStatus(employee, "active")}
                                disabled={updatingStatusEmployeeId === employee.id}
                                style={[
                                  styles.roleChip,
                                  styles.roleChipActive,
                                  updatingStatusEmployeeId === employee.id
                                    ? styles.roleChipDisabled
                                    : null
                                ]}
                              >
                                <Text style={[styles.roleChipText, styles.roleChipTextActive]}>
                                  Reactivate
                                </Text>
                              </Pressable>
                            ) : (
                              <>
                                <Pressable
                                  onPress={() => void updateEmployeeStatus(employee, "suspended_paid")}
                                  disabled={updatingStatusEmployeeId === employee.id}
                                  style={[
                                    styles.roleChip,
                                    updatingStatusEmployeeId === employee.id
                                      ? styles.roleChipDisabled
                                      : null
                                  ]}
                                >
                                  <Text style={styles.roleChipText}>Suspend paid</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => void updateEmployeeStatus(employee, "suspended_unpaid")}
                                  disabled={updatingStatusEmployeeId === employee.id}
                                  style={[
                                    styles.roleChip,
                                    updatingStatusEmployeeId === employee.id
                                      ? styles.roleChipDisabled
                                      : null
                                  ]}
                                >
                                  <Text style={styles.roleChipText}>Suspend unpaid</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => void updateEmployeeStatus(employee, "terminated")}
                                  disabled={updatingStatusEmployeeId === employee.id}
                                  style={[
                                    styles.roleChip,
                                    styles.roleChipDanger,
                                    updatingStatusEmployeeId === employee.id
                                      ? styles.roleChipDisabled
                                      : null
                                  ]}
                                >
                                  <Text style={[styles.roleChipText, styles.roleChipTextActive]}>
                                    Terminate
                                  </Text>
                                </Pressable>
                              </>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No employees added to this branch yet.</Text>
                    )}
                  </View>

                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={setEmployeeEmail}
                    placeholder="Employee email"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={employeeEmail}
                  />
                  <TextInput
                    onChangeText={setEmployeePassword}
                    placeholder="Employee password"
                    placeholderTextColor="#8A918F"
                    secureTextEntry
                    style={styles.input}
                    value={employeePassword}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setEmployeeCode}
                    placeholder="Employee code"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={employeeCode}
                  />
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={setEmployeePhone}
                    placeholder="Phone number (optional)"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={employeePhone}
                  />
                  <View style={styles.roleRow}>
                    {STAFF_ROLE_OPTIONS.map((role) => (
                      <Pressable
                        key={role}
                        onPress={() => setEmployeeRoleType(role)}
                        style={[
                          styles.roleChip,
                          employeeRoleType === role ? styles.roleChipActive : null
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleChipText,
                            employeeRoleType === role ? styles.roleChipTextActive : null
                          ]}
                        >
                          {role}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    disabled={submittingEmployee}
                    onPress={submitEmployee}
                    style={styles.primaryButton}
                  >
                    {submittingEmployee ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add employee</Text>
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
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 8
  },
  listItem: {
    color: "#3B4344"
  },
  employeeCard: {
    gap: 8
  },
  productCard: {
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6DDD0",
    padding: 12
  },
  productCardSelected: {
    borderColor: "#1D5C63",
    backgroundColor: "#F2FAFA"
  },
  employeeTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  employeeMeta: {
    color: "#596467",
    fontSize: 13
  },
  emptyText: {
    color: "#7B8587"
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
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  roleChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7CEC0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  roleChipActive: {
    backgroundColor: "#1D5C63",
    borderColor: "#1D5C63"
  },
  roleChipDanger: {
    backgroundColor: "#A33A2A",
    borderColor: "#A33A2A"
  },
  roleChipText: {
    color: "#1D5C63",
    fontWeight: "600",
    textTransform: "capitalize"
  },
  roleChipTextActive: {
    color: "#FFFFFF"
  },
  roleChipDisabled: {
    opacity: 0.5
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
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
