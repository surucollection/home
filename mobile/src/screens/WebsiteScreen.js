import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius } from "../theme";

const SITE_HOST = "suru.com.np";

export default function WebsiteScreen({ title, url }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const handleNavigation = useCallback((request) => {
    const target = String(request?.url || "");
    if (!target || target === "about:blank") return true;

    try {
      const parsed = new URL(target);
      if (parsed.protocol === "https:" && (
        parsed.hostname === SITE_HOST ||
        parsed.hostname.endsWith("." + SITE_HOST)
      )) {
        return true;
      }
    } catch {
      return false;
    }

    // Keep Contact / About / Policy and every other Suru page inside the app.
    // Send payment providers, social sites, phone/email links and other domains
    // to their normal system handler rather than trapping them in this page.
    if (/^(https?:|mailto:|tel:|sms:)/i.test(target)) {
      Linking.openURL(target).catch((openError) => {
        console.warn("Could not open external link:", openError?.message || openError);
      });
    }
    return false;
  }, []);

  return (
    <View style={styles.screen}>
      <WebView
        key={url + ":" + reloadKey}
        source={{ uri: url }}
        style={styles.webview}
        originWhitelist={["https://*"]}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        onShouldStartLoadWithRequest={handleNavigation}
        onLoadStart={() => { setLoading(true); setError(""); }}
        onLoadEnd={() => setLoading(false)}
        onError={(event) => {
          setLoading(false);
          setError(event?.nativeEvent?.description || "This page could not be loaded. Check your internet connection.");
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading {title || "Suru Collection"}…</Text>
          </View>
        )}
      />
      {!!loading && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading {title || "Suru Collection"}…</Text>
        </View>
      )}
      {!!error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Unable to load this page</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => { setError(""); setLoading(true); setReloadKey((value) => value + 1); }} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry page</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: 10 },
  loadingOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: 10 },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  errorOverlay: { position: "absolute", left: 18, right: 18, top: 18, padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, gap: 9 },
  errorTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  errorText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  retryButton: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: radius.pill },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "800" }
};
