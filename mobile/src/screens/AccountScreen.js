import React from "react";
import { Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { colors, radius } from "../theme";

export default function AccountScreen({ navigate }) {
  const { session, profile, signOut } = useStore();
  if (!session) {
    return <Page>
      <Text style={styles.eyebrow}>YOUR SURU ACCOUNT</Text>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to view your orders, saved delivery details and account information.</Text>
      <Button title="Sign in or create account" onPress={() => navigate("auth")} />
      <Button title="Browse as guest" secondary onPress={() => navigate("shop")} />
    </Page>;
  }
  return (
    <Page>
      <Text style={styles.eyebrow}>YOUR SURU ACCOUNT</Text>
      <Text style={styles.title}>Hello{profile?.first_name ? ", " + profile.first_name : ""}</Text>
      <View style={styles.profileCard}>
        <Text style={styles.name}>{profile?.name || session.user?.email}</Text>
        <Text style={styles.email}>{session.user?.email}</Text>
        {!!profile?.phone && <Text style={styles.detail}>{profile.phone}</Text>}
        {!!profile?.address && <Text style={styles.detail}>{profile.address}, {profile.city || ""}</Text>}
      </View>
      <Button title="My orders and tracking" onPress={() => navigate("orders")} />
      <Button title="Shop the collection" secondary onPress={() => navigate("shop")} />
      <Button title="Sign out" secondary onPress={() => signOut()} style={{ marginTop: 22 }} />
      <Notice>Your account uses the same customer login as suru.com.np.</Notice>
    </Page>
  );
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800", marginTop: 6 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 15 },
  profileCard: { borderRadius: radius.lg, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 16, marginBottom: 12 },
  name: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  email: { color: colors.accent, fontSize: 12, marginTop: 5 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 8 }
};