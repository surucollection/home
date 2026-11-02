import React from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { colors, radius } from "../theme";

function AccountOption({ title, description, onPress }) {
  return <Pressable onPress={onPress} style={styles.option} accessibilityRole="button">
    <View style={{ flex: 1 }}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

export default function AccountScreen({ navigate }) {
  const { session, profile, signOut } = useStore();
  if (!session) return <Page>
    <Text style={styles.eyebrow}>YOUR SURU ACCOUNT</Text>
    <Text style={styles.title}>Welcome back</Text>
    <Text style={styles.subtitle}>Sign in to manage your profile, saved delivery addresses, orders and security.</Text>
    <Button title="Sign in or create account" onPress={() => navigate("auth")} />
    <Button title="Browse as guest" secondary onPress={() => navigate("shop")} />
  </Page>;
  return <Page>
    <Text style={styles.eyebrow}>YOUR SURU ACCOUNT</Text>
    <Text style={styles.title}>Hello{profile?.first_name ? ", " + profile.first_name : ""}</Text>
    <View style={styles.profileCard}>
      <Text style={styles.name}>{profile?.name || session.user?.email}</Text>
      <Text style={styles.email}>{session.user?.email}</Text>
      {!!profile?.phone && <Text style={styles.detail}>{profile.phone}</Text>}
    </View>
    <Text style={styles.sectionTitle}>My account</Text>
    <AccountOption title="Personal details" description="Update your name and phone number" onPress={() => navigate("profile")} />
    <AccountOption title="Saved addresses" description="Add, edit, delete and choose your default delivery address" onPress={() => navigate("addresses")} />
    <AccountOption title="Sign-in & security" description="Change your password and review available sign-in options" onPress={() => navigate("security")} />
    <AccountOption title="My orders and tracking" description="View orders and delivery progress" onPress={() => navigate("orders")} />
    <Button title="Shop the collection" secondary onPress={() => navigate("shop")} />
    <Button title="Sign out" secondary onPress={() => signOut()} style={{ marginTop: 18 }} />
    <Notice>Your account uses the same customer login as suru.com.np.</Notice>
  </Page>;
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800", marginTop: 6 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 15 },
  profileCard: { borderRadius: radius.lg, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 16, marginBottom: 18 },
  name: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  email: { color: colors.accent, fontSize: 12, marginTop: 5 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 15, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 9, gap: 10 },
  optionTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  optionDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  chevron: { color: colors.primary, fontSize: 26, fontWeight: "500" }
};
