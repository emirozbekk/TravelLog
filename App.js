import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";

// Button with a consistent look
const Btn = ({ title, onPress, style, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={{
      backgroundColor: "#111827",
      padding: 12,
      borderRadius: 12,
      opacity: disabled ? 0.6 : 1,
      ...style,
    }}
  >
    <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
      {title}
    </Text>
  </TouchableOpacity>
);

// Small titled block
const Section = ({ title, children }) => (
  <View style={{ marginTop: 16 }}>
    <Text style={{ color: "black", fontWeight: "700", marginBottom: 8 }}>
      {title}
    </Text>
    {children}
  </View>
);

// Demo trips so the app has content on first run
function createMockTrip(i) {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
  return {
    id: String(i),
    title: `Trip #${i + 1}`,
    date: d.toISOString().slice(0, 10),
    notes: i % 2 ? "Sunset by the lake. Tried salmon soup." : "City walk. Museum + coffee.",
    thumb:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQYV2NkYGBg+P//PwMDA4MKMJqGQYQwGg0GQxgAAGlUATr0JzpcAAAAAElFTkSuQmCC",
    coords: { latitude: 60.1699, longitude: 24.9384 }, // Helsinki
  };
}

const initialTrips = Array.from({ length: 3 }, (_, i) => createMockTrip(i));

// Fake weather line for the detail screen
function useMockWeather(coords) {
  return useMemo(() => {
    if (!coords) return null;
    return { tempC: 5 + Math.round(Math.random() * 5), desc: "cloudy", icon: "☁️" };
  }, [coords]);
}

// Simple map picker: long‑press to drop a pin, confirm to return it
const MapPickerModal = ({ visible, onClose, initial, onPick }) => {
  const [marker, setMarker] = useState(initial || null);

  useEffect(() => {
    setMarker(initial || null);
  }, [visible, initial]);

  const initialRegion = initial
    ? { ...initial, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 60.1699, longitude: 24.9384, latitudeDelta: 0.2, longitudeDelta: 0.2 };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "beige" }}>
        <View
          style={{
            paddingTop: Platform.OS === "ios" ? 50 : 30,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          <Text style={{ color: "black", fontSize: 20, fontWeight: "800" }}>
            Pick Location (long‑press to drop pin)
          </Text>
        </View>

        <MapView
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onLongPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setMarker({ latitude, longitude });
          }}
        >
          {marker && <Marker coordinate={marker} />} 
        </MapView>

        <View style={{ padding: 16, flexDirection: "row" }}>
          <Btn
            title="Cancel"
            onPress={onClose}
            style={{ flex: 1, marginRight: 8, backgroundColor: "#111827" }}
          />
          <Btn
            title="Use This Location"
            onPress={() => {
              if (!marker) return Alert.alert("Select a location", "Long‑press the map to drop a pin.");
              onPick(marker);
              onClose();
            }}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </View>
    </Modal>
  );
};

// Small card for the horizontal list
const TripCard = ({ item, onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ width: 160, marginRight: 12 }}>
    <View style={{ backgroundColor: "white", borderRadius: 14, overflow: "hidden" }}>
      <Image source={{ uri: item.thumb }} style={{ width: "100%", height: 90 }} />
      <View style={{ padding: 10 }}>
        <Text style={{ color: "black", fontWeight: "600" }} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ color: "black", fontSize: 12 }}>{item.date}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// Home: a couple of lists and a button to add
const TripsScreen = ({ nav, trips, setSelected }) => (
  <ScrollView style={{ flex: 1, backgroundColor: "beige" }} contentContainerStyle={{ padding: 16 }}>
    <Text style={{ color: "black", fontSize: 22, fontWeight: "800" }}>Trips</Text>

    <Section title="Your trips">
      <FlatList
        data={trips}
        keyExtractor={(i) => i.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TripCard
            item={item}
            onPress={() => {
              setSelected(item);
              nav("detail");
            }}
          />
        )}
        ListEmptyComponent={<Text style={{ color: "black" }}>No trips yet. Add one below.</Text>}
      />
    </Section>

    <Section title="Timeline">
      {trips.map((t) => (
        <View key={t.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: "black", width: 86 }}>{t.date}</Text>
          <Text style={{ color: "black", fontWeight: "600" }}>{t.title}</Text>
        </View>
      ))}
    </Section>

    <Btn title="Add Trip" onPress={() => nav("add")} style={{ marginTop: 16 }} />
  </ScrollView>
);

// Add screen: pick photo + choose coords (current or map)
const AddTripScreen = ({ nav, addTrip }) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [pickedUri, setPickedUri] = useState(null);
  const [coords, setCoords] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Preload a reasonable location so the preview map shows something
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude });
    })();
  }, []);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission needed", "Media library access is required.");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets?.length) setPickedUri(res.assets[0].uri);
  };

  const onSave = () => {
    if (!title.trim()) return Alert.alert("Missing", "Give your trip a title.");
    const finalCoords = coords || { latitude: 60.1699, longitude: 24.9384 };
    addTrip({
      title: title.trim(),
      date,
      notes,
      coords: finalCoords,
      thumb:
        pickedUri ||
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQYV2NkYGBg+P//PwMDA4MKMJqGQYQwGg0GQxgAAGlUATr0JzpcAAAAAElFTkSuQmCC",
    });
    nav("home");
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "beige" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: "black", fontSize: 22, fontWeight: "800" }}>Add New Trip</Text>

      <Text style={{ color: "black", marginTop: 12 }}>Trip Name</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g., Summer in Spain"
        placeholderTextColor="#64748b"
        style={{ backgroundColor: "white", color: "black", borderRadius: 12, padding: 12 }}
      />

      <Text style={{ color: "black", marginTop: 12 }}>Date (YYYY-MM-DD)</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#64748b"
        style={{ backgroundColor: "white", color: "black", borderRadius: 12, padding: 12 }}
      />

      <Text style={{ color: "black", marginTop: 12 }}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Add notes about your trip..."
        placeholderTextColor="#64748b"
        multiline
        numberOfLines={4}
        style={{ backgroundColor: "white", color: "black", borderRadius: 12, padding: 12, minHeight: 100 }}
      />

      <Btn title="📷 Pick Photo" onPress={pickPhoto} style={{ marginTop: 12 }} />
      {pickedUri ? (
        <Image
          source={{ uri: pickedUri }}
          style={{ width: "100%", height: 180, marginTop: 12, borderRadius: 12 }}
        />
      ) : null}

      <Section title="Location">
        <View style={{ flexDirection: "row" }}>
          <Btn
            title="Use Current"
            onPress={async () => {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== "granted") return Alert.alert("Permission", "Location permission required.");
              const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude });
            }}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Btn title="Pick on Map" onPress={() => setPickerOpen(true)} style={{ flex: 1, marginLeft: 8 }} />
        </View>

        {coords ? (
          <View style={{ borderRadius: 12, overflow: "hidden", marginTop: 12 }}>
            <MapView
              style={{ width: "100%", height: 180 }}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
            >
              <Marker coordinate={coords} />
            </MapView>
          </View>
        ) : (
          <Text style={{ color: "black", marginTop: 8 }}>No location selected.</Text>
        )}
      </Section>

      <Btn title="Save Trip" onPress={onSave} style={{ marginTop: 16 }} />
      <Btn title="Cancel" onPress={() => nav("home")} style={{ marginTop: 8, backgroundColor: "#111827" }} />

      <MapPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initial={coords}
        onPick={(c) => setCoords(c)}
      />
    </ScrollView>
  );
};

// Details: show the photo, a static marker, and a fake weather line
const DetailScreen = ({ trip }) => {
  const weather = useMockWeather(trip?.coords);
  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: "beige", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "black" }}>Select a trip from the list.</Text>
      </View>
    );
  }
  
  const region = trip.coords
    ? { ...trip.coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "beige" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: "black", fontSize: 22, fontWeight: "800" }}>{trip.title}</Text>
      <Text style={{ color: "black" }}>{trip.date}</Text>

      <View style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", backgroundColor: "white" }}>
        <Image source={{ uri: trip.thumb }} style={{ width: "100%", height: 160 }} />
      </View>

      <Section title="Location">
        {region ? (
          <View style={{ borderRadius: 12, overflow: "hidden" }}>
            <MapView style={{ width: "100%", height: 220 }} initialRegion={region}>
              <Marker coordinate={trip.coords} title={trip.title} description={trip.date} />
            </MapView>
          </View>
        ) : (
          <Text style={{ color: "black" }}>No coordinates saved.</Text>
        )}
      </Section>

      <Section title="Notes">
          <Text style={{ color: "black" }}>{trip.notes || "No notes"}</Text>
      </Section>

      <Section title="Weather">
        <Text style={{ color: "black" }}>
          {weather ? `${weather.icon} ${weather.tempC}°C · ${weather.desc}` : "—"}
        </Text>
      </Section>
    </ScrollView>
  );
};

// Vertical list that navigates to a detail view
const TimelineScreen = ({ trips, nav, setSelected }) => (
  <ScrollView style={{ flex: 1, backgroundColor: "beige" }} contentContainerStyle={{ padding: 16 }}>
    <Text style={{ color: "black", fontSize: 22, fontWeight: "800" }}>Timeline</Text>
    {trips.map((t) => (
      <TouchableOpacity
        key={t.id}
        onPress={() => {
          setSelected(t);
          nav("detail");
        }}
        style={{
          backgroundColor: "white",
          borderRadius: 14,
          padding: 12,
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Image source={{ uri: t.thumb }} style={{ width: 54, height: 54, borderRadius: 8, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "black", fontWeight: "600" }}>{t.title}</Text>
          <Text style={{ color: "black", marginTop: 2 }}>{t.date}</Text>
        </View>
        <Text style={{ color: "black" }}>›</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// Tiny tab-like router using local state (kept simple on purpose)
export default function App() {
  const [route, setRoute] = useState("home"); // home | add | detail | timeline
  const [trips, setTrips] = useState(initialTrips);
  const [selected, setSelected] = useState(null);

  const nav = (r) => setRoute(r);
  const addTrip = (t) => {
    const id = Date.now().toString();
    const item = { id, ...t };
    setTrips((prev) => [item, ...prev]);
    setSelected(item);
  };

  let Screen = null;
  if (route === "home") Screen = <TripsScreen nav={nav} trips={trips} setSelected={setSelected} />;
  if (route === "add") Screen = <AddTripScreen nav={nav} addTrip={addTrip} />;
  if (route === "detail") Screen = <DetailScreen trip={selected || trips[0]} />;
  if (route === "timeline") Screen = <TimelineScreen trips={trips} nav={nav} setSelected={setSelected} />;

  return (
    <View style={{ flex: 1, backgroundColor: "beige" }}>
      {/* Header */}
      <View
        style={{
          paddingTop: Platform.OS === "ios" ? 50 : 30,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: "black", fontSize: 22, fontWeight: "800" }}>TravelLog</Text>
        
      </View>

      {/* Screen */}
      <View style={{ flex: 1 }}>{Screen}</View>

      {/* Bottom tabs */}
      <View
        style={{
          flexDirection: "row",
          padding: 12,
          borderTopColor: "#1f2937",
          borderTopWidth: 1,
        }}
      >
        <Btn title="Trips" onPress={() => nav("home")} style={{ flex: 1, marginRight: 6 }} />
        <Btn title="Add" onPress={() => nav("add")} style={{ flex: 1, marginHorizontal: 6 }} />
        <Btn title="Details" onPress={() => nav("detail")} style={{ flex: 1, marginHorizontal: 6 }} />
        <Btn title="Timeline" onPress={() => nav("timeline")} style={{ flex: 1, marginLeft: 6 }} />
      </View>
    </View>
  );
}

