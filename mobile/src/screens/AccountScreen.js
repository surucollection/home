import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { colors, radius } from "../theme";

function AccountOption({ title, description, onPress }) {
  return <Pressable onPress={onPress} style={styles.option} accessibilityRole="button">
    <View style={{ flex: 1 }}>
      <Text style={styles.optionTitle}>{title}</Text>
      {!!description && <Text style={styles.optionDescription}>{description}</Text>}
    </View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function openWebsitePage(path) {
  Linking.openURL("https://suru.com.np/" + path).catch((error) => {
    console.warn("Could not open Suru Collection page:", error?.message || error);
  });
}

export default function AccountScreen({ navigate }) {
  const { session, profile, signOut } = useStore();
  return <Page>
    <Text style={styles.eyebrow}>YOUR SURU ACCOUNT</Text>
    {session ? <>
      <Text style={styles.title}>Hello{profile?.first_name ? ", " + profile.first_name : ""}</Text>
      <View style={styles.profileCard}>
        <View style={styles.profileCardRow}>
          <View style={styles.profileDetails}>
            <Text style={styles.name}>{profile?.name || session.user?.email}</Text>
            <Text style={styles.email}>{session.user?.email}</Text>
            {!!profile?.phone && <Text style={styles.detail}>{profile.phone}</Text>}
          </View>
          <Pressable onPress={() => signOut()} style={styles.signOutButton} accessibilityRole="button" accessibilityLabel="Sign out">
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.sectionTitle}>My account</Text>
      <AccountOption title="Personal details" description="Update your name and phone number" onPress={() => navigate("profile")} />
      <AccountOption title="Saved addresses" description="Add, edit, delete and choose your default delivery address" onPress={() => navigate("addresses")} />
      <AccountOption title="Sign-in & security" description="Change your password and review available sign-in options" onPress={() => navigate("security")} />
      <AccountOption title="My orders and tracking" description="View orders and delivery progress" onPress={() => navigate("orders")} />
    </> : <>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to manage your profile, saved delivery addresses, orders and security. Your wishlist is available on this device without signing in.</Text>
      <Button title="Sign in or create account" onPress={() => navigate("auth")} />
      <Button title="Browse as guest" secondary onPress={() => navigate("shop")} />
    </>}
    <Text style={[styles.sectionTitle, styles.helpHeading]}>Help & information</Text>
    <AccountOption title="Contact Us" description="Questions about products, orders or delivery" onPress={() => openWebsitePage("contact.html")} />
    <AccountOption title="About Suru Collection" description="Learn about our story and collections" onPress={() => openWebsitePage("about.html")} />
    <AccountOption title="Policies & Terms" description="Privacy, delivery, returns and other policies" onPress={() => openWebsitePage("policy.html")} />
    <Notice>Your account uses the same customer login as suru.com.np.</Notice>
  </Page>;
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800", marginTop: 6 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 15 },
  profileCard: { borderRadius: radius.lg, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 16, marginBottom: 18 },
  profileCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileDetails: { flex: 1, minWidth: 0 },
  signOutButton: { minHeight: 40, minWidth: 88, paddingHorizontal: 13, paddingVertical: 9, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  signOutText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  name: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  email: { color: colors.accent, fontSize: 12, marginTop: 5 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  helpHeading: { marginTop: 18 },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 15, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 9, gap: 10 },
  optionTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  optionDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  chevron: { color: colors.primary, fontSize: 26, fontWeight: "500" }
};
