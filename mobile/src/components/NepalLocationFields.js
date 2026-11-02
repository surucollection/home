import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
  return <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.pickerBox, disabled && styles.disabled]}>
      {loading ? <ActivityIndicator color={colors.primary} style={{ padding: 13 }} /> : (
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
  error: { color: colors.danger, fontSize: 10, lineHeight: 15, marginTop: -6, marginBottom: 10 }
};
