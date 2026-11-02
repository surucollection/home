import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme";

export default function NcmBranchDropdown({ value, options = [], onSelect, disabled = false }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((item) => item.name === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => {
      const branch = item.branch || {};
      return [item.name, branch.municipality, branch.district_name, branch.address, branch.areas_covered]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [options, search]);

  function close() {
    setVisible(false);
    setSearch("");
  }

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose NCM destination branch"
      onPress={() => { setSearch(""); setVisible(true); }}
      disabled={disabled}
      style={[styles.field, disabled && styles.disabled]}
    >
      <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
        {value || (disabled ? "Select your district first" : "Choose NCM branch")}
      </Text>
      <Text style={styles.chevron}>⌄</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Choose NCM branch</Text>
            <Pressable onPress={close} hitSlop={10}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search branches in your district"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={styles.search}
          />
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
            {filtered.map((item) => {
              const branch = item.branch || {};
              const active = item.name === value;
              const detail = [branch.municipality, branch.district_name].filter(Boolean).join(" · ");
              return <Pressable
                key={String(branch.pk || branch.code || item.name)}
                onPress={() => { onSelect(item.name); close(); }}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionName}>{item.name}</Text>
                  {!!detail && <Text style={styles.optionDetail}>{detail}</Text>}
                </View>
                {active && <Text style={styles.selected}>SELECTED</Text>}
              </Pressable>;
            })}
            {!filtered.length && <Text style={styles.empty}>No matching branches in this district.</Text>}
          </ScrollView>
          <Text style={styles.footer}>{options.length} branch option{options.length === 1 ? "" : "s"} for this address</Text>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = {
  field: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  disabled: { opacity: 0.55 },
  value: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "600" },
  placeholder: { color: colors.muted, fontWeight: "400" },
  chevron: { color: colors.primary, fontSize: 22, marginLeft: 10, marginTop: -5 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(20,12,10,0.35)" },
  sheet: { maxHeight: "82%", minHeight: "45%", backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22 },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  close: { color: colors.primary, fontSize: 18, fontWeight: "800", padding: 4 },
  search: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: 13, marginBottom: 10, fontSize: 13 },
  list: { flexGrow: 1 },
  option: { minHeight: 54, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  optionActive: { backgroundColor: colors.surfaceSoft, paddingHorizontal: 9, borderRadius: 9 },
  optionName: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  optionDetail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  selected: { color: colors.success, fontSize: 9, fontWeight: "900" },
  empty: { color: colors.muted, textAlign: "center", padding: 25, fontSize: 12 },
  footer: { color: colors.muted, fontSize: 10, textAlign: "center", paddingTop: 10 }
};
