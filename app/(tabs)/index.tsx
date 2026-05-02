import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BleManager, Device } from "react-native-ble-plx";

function estimateDistance(rssi: number | null | undefined): number | null {
  if (rssi == null) {
    return null;
  }

  const txPower = -59;
  const pathLossExponent = 2.4;
  const distance = Math.pow(10, (txPower - rssi) / (10 * pathLossExponent));

  return Math.round(distance * 10) / 10;
}

function getAverageRssi(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.round(total / values.length);
}

function getProximityLabel(
  averageRssi: number | null,
  isSignalLost: boolean,
): string {
  if (isSignalLost) {
    return "Signal lost";
  }

  if (averageRssi == null) {
    return "Unknown";
  }

  if (averageRssi >= -50) {
    return "Very close";
  }

  if (averageRssi >= -65) {
    return "Close";
  }

  if (averageRssi >= -80) {
    return "Nearby";
  }

  return "Far";
}

function getSignalStrengthPercent(rssi: number | null): number {
  if (rssi == null) {
    return 0;
  }

  const minRssi = -95;
  const maxRssi = -40;
  const clamped = Math.max(minRssi, Math.min(maxRssi, rssi));

  return Math.round(((clamped - minRssi) / (maxRssi - minRssi)) * 100);
}

export default function HomeScreen() {
  const manager = useMemo(() => new BleManager(), []);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rssiHistoryRef = useRef<number[]>([]);
  const lastSeenAtRef = useRef<number | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [currentRssi, setCurrentRssi] = useState<number | null>(null);
  const [averageRssi, setAverageRssi] = useState<number | null>(null);
  const [isSignalLost, setIsSignalLost] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const selectedDeviceId = selectedDevice?.id;

  async function requestBluetoothPermissions() {
    if (Platform.OS !== "android") {
      return true;
    }

    const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    if (Platform.Version >= 31) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );
    }

    const results = await PermissionsAndroid.requestMultiple(permissions);

    return permissions.every(
      (permission) =>
        results[permission] === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  function stopScan() {
    manager.stopDeviceScan();
    setIsScanning(false);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }

  function resetRadarState() {
    rssiHistoryRef.current = [];
    lastSeenAtRef.current = null;
    setCurrentRssi(null);
    setAverageRssi(null);
    setIsSignalLost(false);
  }

  function openRadarMode(device: Device) {
    stopScan();
    setErrorMessage("");
    resetRadarState();
    lastSeenAtRef.current = Date.now();

    if (device.rssi != null) {
      rssiHistoryRef.current = [device.rssi];
      setCurrentRssi(device.rssi);
      setAverageRssi(device.rssi);
    }

    setSelectedDevice(device);
  }

  function closeRadarMode() {
    manager.stopDeviceScan();
    setSelectedDevice(null);
    resetRadarState();
  }

  async function startScan() {
    const hasPermissions = await requestBluetoothPermissions();

    if (!hasPermissions) {
      setErrorMessage("Bluetooth permissions were not granted.");
      return;
    }

    setErrorMessage("");
    setDevices([]);
    setIsScanning(true);

    manager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        setErrorMessage(error.message);
        stopScan();
        return;
      }

      if (!scannedDevice) {
        return;
      }

      // Keep one item per device id, because the same device can be found many times.
      setDevices((currentDevices) => {
        const alreadyFound = currentDevices.some(
          (device) => device.id === scannedDevice.id,
        );

        if (alreadyFound) {
          return currentDevices.map((device) =>
            device.id === scannedDevice.id ? scannedDevice : device,
          );
        }

        return [...currentDevices, scannedDevice];
      });
    });

    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
    }, 10000);
  }

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
      manager.destroy();

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [manager]);

  useEffect(() => {
    if (!selectedDeviceId) {
      return;
    }

    let isRadarActive = true;

    async function startRadarScan() {
      const hasPermissions = await requestBluetoothPermissions();

      if (!hasPermissions) {
        setErrorMessage("Bluetooth permissions were not granted.");
        return;
      }

      setErrorMessage("");

      manager.startDeviceScan(null, null, (error, scannedDevice) => {
        if (error) {
          setErrorMessage(error.message);
          manager.stopDeviceScan();
          return;
        }

        if (
          !isRadarActive ||
          !scannedDevice ||
          scannedDevice.id !== selectedDeviceId
        ) {
          return;
        }

        lastSeenAtRef.current = Date.now();
        setIsSignalLost(false);

        if (scannedDevice.rssi != null) {
          const nextHistory = [...rssiHistoryRef.current, scannedDevice.rssi].slice(
            -8,
          );

          rssiHistoryRef.current = nextHistory;
          setCurrentRssi(scannedDevice.rssi);
          setAverageRssi(getAverageRssi(nextHistory));
        }

        // Keep device info fresh, but use separate RSSI state for smoothing.
        setSelectedDevice(scannedDevice);
      });
    }

    startRadarScan();

    return () => {
      isRadarActive = false;
      manager.stopDeviceScan();
    };
  }, [manager, selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) {
      return;
    }

    const intervalId = setInterval(() => {
      if (!lastSeenAtRef.current) {
        return;
      }

      setIsSignalLost(Date.now() - lastSeenAtRef.current > 6000);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedDeviceId]);

  if (selectedDevice) {
    const distance = estimateDistance(averageRssi);
    const proximityLabel = getProximityLabel(averageRssi, isSignalLost);
    const signalPercent = getSignalStrengthPercent(
      isSignalLost ? null : averageRssi,
    );

    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Radar mode</Text>
        <Text style={styles.description}>
          {selectedDevice.name || selectedDevice.localName || "Unknown device"}
        </Text>

        {errorMessage ? (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        ) : null}

        <View style={styles.radarCircle}>
          <Text style={styles.proximityLabel}>{proximityLabel}</Text>
          <Text style={styles.distanceText}>
            {signalPercent}% signal
          </Text>
        </View>

        <View style={styles.deviceCard}>
          <Text style={styles.deviceDetail}>ID: {selectedDevice.id}</Text>
          <Text style={styles.deviceDetail}>
            Current RSSI: {currentRssi ?? "Unknown"}
          </Text>
          <Text style={styles.deviceDetail}>
            Average RSSI: {averageRssi ?? "Unknown"}
          </Text>
          <Text style={styles.deviceDetail}>
            Estimated distance:{" "}
            {distance == null ? "Unknown" : `${distance} meters`}
          </Text>
          <Text style={styles.deviceDetail}>Proximity: {proximityLabel}</Text>

          <View style={styles.signalBarBackground}>
            <View
              style={[
                styles.signalBarFill,
                { width: `${signalPercent}%` },
              ]}
            />
          </View>
        </View>

        <Pressable style={styles.backButton} onPress={closeRadarMode}>
          <Text style={styles.backButtonText}>Back to scan</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Bluetooth Radar</Text>
        <Text style={styles.description}>Nearby BLE devices</Text>
      </View>

      <Pressable
        style={[styles.scanButton, isScanning && styles.stopButton]}
        onPress={isScanning ? stopScan : startScan}
      >
        <Text style={styles.scanButtonText}>
          {isScanning ? "Stop scan" : "Start scan"}
        </Text>
      </Pressable>

      {errorMessage ? (
        <Text style={styles.errorMessage}>{errorMessage}</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Found devices</Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isScanning
              ? "Scanning for BLE devices..."
              : "No BLE devices found yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.deviceCard}
            onPress={() => openRadarMode(item)}
          >
            <Text style={styles.deviceName}>
              {item.name || item.localName || "Unknown device"}
            </Text>
            <Text style={styles.deviceDetail}>ID: {item.id}</Text>
            <Text style={styles.deviceDetail}>
              RSSI: {item.rssi ?? "Unknown"}
            </Text>
          </Pressable>
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
  stopButton: {
    backgroundColor: "#DC2626",
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  errorMessage: {
    color: "#B91C1C",
    fontSize: 14,
    marginTop: 14,
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
  emptyText: {
    color: "#6B7280",
    fontSize: 15,
  },
  deviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
  },
  deviceName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  deviceDetail: {
    color: "#4B5563",
    fontSize: 14,
    marginTop: 6,
  },
  radarCircle: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#DBEAFE",
    borderColor: "#2563EB",
    borderRadius: 100,
    borderWidth: 4,
    height: 200,
    justifyContent: "center",
    marginVertical: 32,
    width: 200,
  },
  proximityLabel: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  distanceText: {
    color: "#2563EB",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  signalBarBackground: {
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    height: 14,
    marginTop: 18,
    overflow: "hidden",
  },
  signalBarFill: {
    backgroundColor: "#22C55E",
    borderRadius: 8,
    height: "100%",
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    marginTop: 20,
    paddingVertical: 14,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
