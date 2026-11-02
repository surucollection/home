import React, { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../lib/supabase";
import { Button, Notice } from "./UI";
import { colors, radius } from "../theme";
import { money } from "../lib/format";

export default function FonepayPaymentPanel({ payment, session, purpose = "full", title = "Fonepay payment" }) {
  const [banks, setBanks] = useState([]);
  const [banksOpen, setBanksOpen] = useState(false);
  const [banksBusy, setBanksBusy] = useState(false);
  const [banksError, setBanksError] = useState("");
  const [openingBank, setOpeningBank] = useState("");

  async function loadBanks() {
    setBanksBusy(true);
    setBanksError("");
    try {
      if (!session?.user) {
        throw new Error("Sign in to load your bank apps. You can still scan the QR code below.");
      }
      const { data, error } = await supabase.functions.invoke("fonepay-payment", {
        body: { action: "banks" }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const raw = data?.banks ?? data?.bankDetails ?? data?.data?.bankDetails ?? data?.data;
      const list = Array.isArray(raw) ? raw : [];
      const usable = list.filter((bank) =>
        bank && String(bank.bankName || "").trim() && String(bank.intentScheme || "").trim()
      );
      if (!usable.length) {
        throw new Error("No compatible Fonepay bank apps were returned. Please scan the QR code with another device.");
      }
      setBanks(usable);
      setBanksOpen(true);
    } catch (error) {
      setBanksError(error?.message || "Unable to load bank apps. Please use the QR code.");
    } finally {
      setBanksBusy(false);
    }
  }

  async function openBankApp(bank) {
    const scheme = String(bank?.intentScheme || "").trim();
    const payload = String(payment?.qrString || payment?.qrMessage || "").trim();
    if (!scheme || !payload) {
      setBanksError("This payment app cannot be opened for the current QR. Please scan the QR code.");
      return;
    }
    const base = scheme.endsWith("/") ? scheme : scheme + "/";
    const uri = base + "?qrPayload=" + encodeURIComponent(payload);
    setOpeningBank(bank.bankName || "");
    setBanksError("");
    try {
      await Linking.openURL(uri);
    } catch (error) {
      setBanksError("Could not open " + (bank.bankName || "that app") + ". Make sure it is installed, or scan the QR code instead.");
    } finally {
      setOpeningBank("");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.amount}>{money(payment?.amount)}</Text>
      {!!payment?.reference && <Text style={styles.reference}>Reference: {payment.reference}</Text>}
      {!!payment?.balanceDue && purpose === "cod_advance" && (
        <Notice>Remaining COD balance: {money(payment.balanceDue)} payable on delivery.</Notice>
      )}
      {payment?.qrString ? (
        <View style={styles.qrWrap}>
          <QRCode value={String(payment.qrString)} size={220} />
        </View>
      ) : (
        <Notice tone="error">The Fonepay QR is not available in this response. Please contact Suru Collection before making another payment attempt.</Notice>
      )}
      <Text style={styles.qrHint}>Scan this QR using a supported banking or wallet app.</Text>
      <Button
        title={banksBusy ? "Loading bank apps…" : banksOpen ? "Hide bank apps" : "Pay with any app"}
        secondary
        loading={banksBusy}
        onPress={banksOpen ? () => setBanksOpen(false) : loadBanks}
        disabled={!payment?.qrString || banksBusy}
      />
      {!!banksError && <Notice tone="error">{banksError}</Notice>}
      {banksOpen && (
        <View style={styles.bankPanel}>
          <Text style={styles.bankHeading}>Choose your bank or wallet</Text>
          {banks.map((bank, index) => (
            <Pressable
              key={bank.bankCode || bank.bankName || index}
              onPress={() => openBankApp(bank)}
              disabled={!!openingBank}
              style={styles.bankRow}
              accessibilityRole="button"
              accessibilityLabel={"Pay with " + bank.bankName}
            >
              {bank.bankIcon
                ? <Image source={{ uri: bank.bankIcon }} style={styles.bankIcon} resizeMode="contain" />
                : <View style={styles.bankFallback}><Text style={styles.bankFallbackText}>F</Text></View>}
              <Text style={styles.bankName}>{bank.bankName}</Text>
              <Text style={styles.bankAction}>{openingBank === bank.bankName ? "Opening…" : "Open"}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.status}>Payment status is checked automatically. Keep this screen open after returning from your banking app.</Text>
    </View>
  );
}

const styles = {
  wrap: { width: "100%", alignItems: "stretch", marginTop: 10 },
  heading: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  amount: { color: colors.primary, fontSize: 23, fontWeight: "900", textAlign: "center", marginTop: 7 },
  reference: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 4 },
  qrWrap: { backgroundColor: colors.white, alignSelf: "center", padding: 16, borderRadius: radius.md, marginTop: 18, borderWidth: 1, borderColor: colors.border },
  qrHint: { color: colors.muted, fontSize: 11, textAlign: "center", lineHeight: 17, marginTop: 9, marginBottom: 8 },
  bankPanel: { marginTop: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  bankHeading: { color: colors.ink, fontSize: 13, fontWeight: "800", marginBottom: 8 },
  bankRow: { flexDirection: "row", alignItems: "center", minHeight: 54, paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  bankIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceSoft },
  bankFallback: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  bankFallbackText: { color: colors.white, fontWeight: "900", fontSize: 18 },
  bankName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "700" },
  bankAction: { color: colors.accent, fontSize: 11, fontWeight: "800" },
  status: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 13 }
};
