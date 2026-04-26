import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

type Device = {
  id: string;
  name: string;
  type: string;
  signalStrength: number;
  status: "Near" | "Medium" | "Far";
};

const fakeDevices: Device[] = [
  {
    id: "1",
    name: "JBL Flip 6",
    type: "Speaker",
    signalStrength: 92,
    status: "Near",
  },
  {
    id: "2",
    name: "Galaxy Watch",
    type: "Wearable",
    signalStrength: 64,
    status: "Medium",
  },
  {
    id: "3",
    name: "Keyboard K380",
    type: "Keyboard",
    signalStrength: 38,
    status: "Far",
  },
];

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Bluetooth Radar</Text>
        <Text style={styles.description}>
          A simple preview for finding nearby Bluetooth devices. Real scanning
          will come later.
        </Text>
      </View>

      {/* This button is only visual for now. Bluetooth scanning is not connected yet. */}
      <Pressable style={styles.scanButton}>
        <Text style={styles.scanButtonText}>Scan nearby devices</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Found devices</Text>

      <FlatList
        data={fakeDevices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.deviceCard}>
            <View style={styles.deviceHeader}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>

            <Text style={styles.deviceType}>{item.type}</Text>

            <View style={styles.signalRow}>
              <Text style={styles.signalLabel}>Signal strength</Text>
              <Text style={styles.signalValue}>{item.signalStrength}%</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FB",
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "700",
  },
  description: {
    color: "#4B5563",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  scanButton: {
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 14,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 28,
  },
  listContent: {
    gap: 12,
    paddingTop: 14,
    paddingBottom: 32,
  },
  deviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
  },
  deviceHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deviceName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  status: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
  },
  deviceType: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 4,
  },
  signalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  signalLabel: {
    color: "#4B5563",
    fontSize: 14,
  },
  signalValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
});
