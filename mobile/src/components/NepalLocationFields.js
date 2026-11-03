import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { colors } from "../theme";

export const NEPAL_PROVINCES = [
  { name: "Koshi Province", districts: ["Taplejung","Sankhuwasabha","Solukhumbu","Okhaldhunga","Khotang","Bhojpur","Dhankuta","Tehrathum","Panchthar","Ilam","Jhapa","Morang","Sunsari","Udayapur"] },
  { name: "Madhesh Province", districts: ["Saptari","Siraha","Dhanusha","Mahottari","Sarlahi","Rautahat","Bara","Parsa"] },
  { name: "Bagmati Province", districts: ["Dolakha","Ramechhap","Sindhuli","Rasuwa","Sindhupalchok","Kavrepalanchok","Nuwakot","Kathmandu","Bhaktapur","Lalitpur","Makwanpur","Chitwan","Dhading"] },
  { name: "Gandaki Province", districts: ["Gorkha","Manang","Mustang","Myagdi","Kaski","Lamjung","Tanahun","Nawalpur","Syangja","Parbat","Baglung"] },
  { name: "Lumbini Province", districts: ["Rukum East","Rolpa","Pyuthan","Gulmi","Arghakhanchi","Palpa","Nawalparasi West","Rupandehi","Kapilvastu","Dang","Banke","Bardiya"] },
  { name: "Karnali Province", districts: ["Dolpa","Mugu","Humla","Jumla","Kalikot","Dailekh","Jajarkot","Rukum West","Salyan","Surkhet"] },
  { name: "Sudurpashchim Province", districts: ["Bajura","Bajhang","Darchula","Baitadi","Dadeldhura","Doti","Achham","Kailali","Kanchanpur"] }
];

export function canonicalLocationProvince(value) {
  const v = String(value || "").trim().toLowerCase();
  const legacy = {
    "province 1": "Koshi Province", "province no. 1": "Koshi Province",
    "province 2": "Madhesh Province", "province no. 2": "Madhesh Province",
    "province 3": "Bagmati Province", "province no. 3": "Bagmati Province",
    "province 4": "Gandaki Province", "province no. 4": "Gandaki Province",
    "province 5": "Lumbini Province", "province no. 5": "Lumbini Province",
    "province 6": "Karnali Province", "province no. 6": "Karnali Province",
    "province 7": "Sudurpashchim Province", "province no. 7": "Sudurpashchim Province",
    "koshi": "Koshi Province", "madhesh": "Madhesh Province",
    "bagmati": "Bagmati Province", "gandaki": "Gandaki Province",
    "lumbini": "Lumbini Province", "karnali": "Karnali Province",
    "sudurpaschim": "Sudurpashchim Province", "sudurpashchim": "Sudurpashchim Province"
  };
  return legacy[v] || NEPAL_PROVINCES.find((p) => p.name.toLowerCase() === v)?.name || String(value || "");
}

const MUNICIPALITY_URL = "https://raw.githubusercontent.com/surucollection/home/feat/native-mobile-app/src/lib/nepalMunicipalities.json";
let municipalityRowsPromise = null;
async function getMunicipalityRows() {
  if (!municipalityRowsPromise) {
    municipalityRowsPromise = fetch(MUNICIPALITY_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Municipality list could not be downloaded.");
        return response.json();
      })
      .then((rows) => Array.isArray(rows) ? rows : [])
      .catch((error) => {
        municipalityRowsPromise = null;
        throw error;
      });
  }
  return municipalityRowsPromise;
}

function normalizedName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const districtAliases = {
  nawalpur: "nawalparasieast",
  tehrathum: "terhathum",
  panchthar: "pachthar",
  kapilvastu: "kapilbastu"
};

export async function getNepalMunicipalities(province, district) {
  const canonical = canonicalLocationProvince(province);
  const provinceCode = ({
    "Koshi Province": "1", "Madhesh Province": "2", "Bagmati Province": "3",
    "Gandaki Province": "4", "Lumbini Province": "5", "Karnali Province": "6",
    "Sudurpashchim Province": "7"
  })[canonical];
  if (!provinceCode || !district) return [];
  const rows = await getMunicipalityRows();
  const wanted = normalizedName(district);
  const target = districtAliases[wanted] || wanted;
  return rows
    .filter((item) => item.provinceCode === provinceCode &&
      (normalizedName(item.district) === target || districtAliases[normalizedName(item.district)] === wanted))
    .map((item) => item.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function PickerBox({ label, value, onValueChange, options, placeholder, disabled = false, loading = false }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value || placeholder;
  return <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.pickerBox, disabled && styles.disabled]}>
      {loading ? <ActivityIndicator color={colors.primary} style={{ padding: 13 }} /> : Platform.OS === "ios" ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={label + ": " + selectedLabel}
            accessibilityState={{ disabled }} disabled={disabled} onPress={() => setOpen(true)}
            style={styles.dropdownTrigger}>
            <Text numberOfLines={1} style={[styles.dropdownValue, !value && styles.placeholder]}>{selectedLabel}</Text>
            <Text style={styles.dropdownChevron}>⌄</Text>
          </Pressable>
          <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
              <Pressable style={styles.dropdownPanel} onPress={() => {}}>
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>Select {label.toLowerCase()}</Text>
                  <Pressable onPress={() => setOpen(false)} hitSlop={10}><Text style={styles.dropdownClose}>×</Text></Pressable>
                </View>
                <ScrollView style={styles.dropdownOptions} keyboardShouldPersistTaps="handled">
                  <Pressable onPress={() => { onValueChange(""); setOpen(false); }}
                    style={[styles.dropdownOption, !value && styles.dropdownOptionSelected]}>
                    <Text style={[styles.dropdownOptionText, !value && styles.dropdownOptionTextSelected]}>{placeholder}</Text>
                  </Pressable>
                  {options.map((option) => {
                    const selected = option === value;
                    return <Pressable key={option} onPress={() => { onValueChange(option); setOpen(false); }}
                      style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}>
                      <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextSelected]}>{option}</Text>
                      {selected && <Text style={styles.dropdownCheck}>✓</Text>}
                    </Pressable>;
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : (
        <Picker selectedValue={value || ""} onValueChange={onValueChange} enabled={!disabled}>
          <Picker.Item label={placeholder} value="" />
          {options.map((option) => <Picker.Item key={option} label={option} value={option} />)}
        </Picker>
      )}
    </View>
  </View>;
}

export default function NepalLocationFields({ province, district, city, onProvinceChange, onDistrictChange, onCityChange }) {
  const [municipalities, setMunicipalities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedProvince = canonicalLocationProvince(province);
  const districts = useMemo(
    () => NEPAL_PROVINCES.find((item) => item.name === selectedProvince)?.districts || [],
    [selectedProvince]
  );

  useEffect(() => {
    let active = true;
    if (!selectedProvince || !district) {
      setMunicipalities([]);
      setError("");
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    getNepalMunicipalities(selectedProvince, district)
      .then((rows) => { if (active) setMunicipalities(rows); })
      .catch((err) => { if (active) { setMunicipalities([]); setError(err?.message || "Municipality list is unavailable."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProvince, district]);

  const cityOptions = city && !municipalities.some((item) => normalizedName(item) === normalizedName(city))
    ? [city, ...municipalities]
    : municipalities;

  return <View>
    <PickerBox
      label="Province"
      value={selectedProvince}
      placeholder="Select province"
      options={NEPAL_PROVINCES.map((item) => item.name)}
      onValueChange={(value) => onProvinceChange(value)}
    />
    <PickerBox
      label="District"
      value={district}
      placeholder={selectedProvince ? "Select district" : "Select province first"}
      options={districts}
      onValueChange={(value) => onDistrictChange(value)}
      disabled={!selectedProvince}
    />
    <PickerBox
      label="City / Municipality"
      value={city}
      placeholder={district ? (loading ? "Loading municipalities…" : "Select city / municipality") : "Select district first"}
      options={cityOptions}
      onValueChange={onCityChange}
      disabled={!district || (municipalities.length === 0 && !loading)}
      loading={loading}
    />
    {!!error && <Text style={styles.error}>{error} If needed, check your internet connection and reopen this screen.</Text>}
  </View>;
}

const styles = {
  fieldWrap: { marginBottom: 12 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 5 },
  pickerBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  disabled: { opacity: 0.55 },
  dropdownTrigger: { minHeight: 56, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dropdownValue: { flex: 1, color: colors.ink, fontSize: 15 },
  placeholder: { color: colors.muted },
  dropdownChevron: { color: colors.primary, fontSize: 22, lineHeight: 25 },
  dropdownOverlay: { flex: 1, backgroundColor: "rgba(28,16,14,0.42)", justifyContent: "center", padding: 24 },
  dropdownPanel: { maxHeight: "78%", backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  dropdownHeader: { minHeight: 58, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  dropdownClose: { color: colors.primary, fontSize: 28, lineHeight: 30, paddingHorizontal: 4 },
  dropdownOptions: { paddingHorizontal: 10, paddingVertical: 8 },
  dropdownOption: { minHeight: 50, paddingHorizontal: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownOptionSelected: { backgroundColor: colors.surfaceSoft },
  dropdownOptionText: { color: colors.ink, fontSize: 15 },
  dropdownOptionTextSelected: { color: colors.primary, fontWeight: "800" },
  dropdownCheck: { color: colors.primary, fontSize: 17, fontWeight: "900" },
  error: { color: colors.danger, fontSize: 10, lineHeight: 15, marginTop: -6, marginBottom: 10 }
};
