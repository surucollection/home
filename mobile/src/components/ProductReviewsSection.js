import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useStore } from "../StoreContext";
import { supabase } from "../lib/supabase";
import { Button, Notice } from "./UI";
import { colors, radius } from "../theme";

const starString = (value) => "★".repeat(Math.max(0, Math.min(5, value))) + "☆".repeat(Math.max(0, 5 - value));

export default function ProductReviewsSection({ product, onSignIn }) {
  const { session, profile } = useStore();
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [{ data, error: reviewError }, { data: authData }] = await Promise.all([
          supabase.from("product_reviews")
            .select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at,is_approved")
            .eq("product_id", product.id)
            .order("created_at", { ascending: false }),
          supabase.auth.getUser()
        ]);
        if (reviewError) throw reviewError;
        if (!active) return;
        const rows = data || [];
        const userId = authData?.user?.id || session?.user?.id || null;
        const own = userId ? rows.find((item) => item.user_id === userId) || null : null;
        setReviews(rows.filter((item) => item.is_approved));
        setMyReview(own);
        setDisplayName(own?.display_name || profile?.name || authData?.user?.email?.split("@")[0] || "Customer");
        if (own) {
          setRating(Number(own.rating) || 5);
          setTitle(own.title || "");
          setReviewText(own.review_text || "");
        }
      } catch (loadError) {
        if (active) setError(loadError?.message || "Unable to load customer reviews.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [product.id, session?.user?.id, profile?.name]);

  const average = useMemo(
    () => reviews.length ? reviews.reduce((total, item) => total + Number(item.rating || 0), 0) / reviews.length : 0,
    [reviews]
  );

  async function submitReview() {
    setError("");
    setNotice("");
    const cleanText = reviewText.trim();
    if (!cleanText || cleanText.length < 5) {
      setError("Please write at least 5 characters about your experience.");
      return;
    }
    if (!session?.user?.id) {
      onSignIn?.();
      return;
    }
    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user;
      if (!user?.id || user.id !== session.user.id) throw new Error("Your sign-in changed. Please sign in again.");
      const payload = {
        product_id: product.id,
        user_id: user.id,
        display_name: displayName.trim().slice(0, 80) || user.email?.split("@")[0] || "Customer",
        rating: Number(rating),
        title: title.trim().slice(0, 120) || null,
        review_text: cleanText,
        updated_at: new Date().toISOString(),
        is_approved: false
      };
      const { data, error: saveError } = await supabase.from("product_reviews")
        .upsert(payload, { onConflict: "product_id,user_id" })
        .select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at,is_approved")
        .single();
      if (saveError) throw saveError;
      setMyReview(data);
      setReviews((previous) => previous.filter((item) => item.user_id !== user.id));
      setEditing(false);
      setNotice(myReview
        ? "Your review was updated and sent for approval again."
        : "Thank you! Your review has been submitted and will appear after approval.");
    } catch (saveError) {
      setError(saveError?.message || "Unable to save your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CUSTOMER FEEDBACK</Text>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>
        </View>
        {reviews.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryStars}>{starString(Math.round(average))}</Text>
            <Text style={styles.summaryAverage}>{average.toFixed(1)}</Text>
            <Text style={styles.summaryCount}>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading reviews…</Text>
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyStar}>☆</Text>
          <Text style={styles.emptyTitle}>Be the first to review this product</Text>
          <Text style={styles.muted}>Your feedback helps other customers choose with confidence.</Text>
        </View>
      ) : reviews.map((item) => (
        <View key={item.id} style={styles.reviewCard}>
          <View style={styles.reviewTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{String(item.display_name || "C").trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewer}>{item.display_name}</Text>
              <Text style={styles.date}>{item.created_at ? new Date(item.created_at).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" }) : ""}</Text>
            </View>
            <Text style={styles.reviewStars}>{starString(Number(item.rating) || 0)}</Text>
          </View>
          {!!item.title && <Text style={styles.reviewTitle}>{item.title}</Text>}
          <Text style={styles.reviewBody}>{item.review_text}</Text>
          {item.user_id === session?.user?.id && (
            <View style={styles.ownReviewRow}>
              <Text style={styles.ownReviewLabel}>Your review</Text>
              <Pressable onPress={() => {
                setRating(Number(myReview?.rating) || 5);
                setTitle(myReview?.title || "");
                setReviewText(myReview?.review_text || "");
                setDisplayName(myReview?.display_name || displayName);
                setError("");
                setNotice("");
                setEditing(true);
              }}>
                <Text style={styles.editAction}>Edit review</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      {myReview && !myReview.is_approved && !editing && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>Your review is awaiting approval</Text>
          <Text style={styles.muted}>Only approved reviews are shown publicly.</Text>
          <Button title="Edit review" secondary onPress={() => setEditing(true)} />
        </View>
      )}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{myReview ? "Your customer review" : "Write a review"}</Text>
        {!session?.user ? (
          <>
            <Text style={styles.formIntro}>Sign in to leave a review.</Text>
            <Button title="Sign in to review" onPress={onSignIn} />
          </>
        ) : myReview && !editing ? (
          <Text style={styles.formIntro}>You have already reviewed this product. Use Edit review to make changes.</Text>
        ) : (
          <>
            <Text style={styles.formIntro}>Tried this product? Share your thoughts with other shoppers.</Text>
            <Text style={styles.fieldLabel}>Your rating</Text>
            <View style={styles.ratingPicker}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)} accessibilityRole="button" accessibilityLabel={value + " star rating"}>
                  <Text style={[styles.ratingStar, value <= rating && styles.ratingStarSelected]}>{value <= rating ? "★" : "☆"}</Text>
                </Pressable>
              ))}
              <Text style={styles.ratingValue}>{rating} of 5</Text>
            </View>
            <Text style={styles.fieldLabel}>Title (optional)</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Sum up your experience" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.fieldLabel}>Your review</Text>
            <TextInput value={reviewText} onChangeText={setReviewText} multiline minHeight={110} textAlignVertical="top" maxLength={2000} placeholder="What did you like or notice about this product?" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} />
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput value={displayName} onChangeText={setDisplayName} maxLength={80} placeholder="Your display name" placeholderTextColor={colors.muted} style={styles.input} />
            <Button title={submitting ? "Saving…" : myReview ? "Save changes" : "Submit Review"} onPress={submitReview} loading={submitting} disabled={submitting} />
            {editing && <Button title="Cancel" secondary onPress={() => { setEditing(false); setError(""); setNotice(""); }} />}
          </>
        )}
        {!!error && <Notice tone="error">{error}</Notice>}
        {!!notice && <Notice tone="success">{notice}</Notice>}
        <Text style={styles.note}>One review per account for each product. New reviews and edits must be approved by Suru Collection before they appear publicly.</Text>
      </View>
    </View>
  );
}

const styles = {
  section: { marginTop: 28, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.border },
  heading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 16 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  summary: { alignItems: "flex-end", gap: 1 },
  summaryStars: { color: "#C58B28", fontSize: 13, letterSpacing: 0.5 },
  summaryAverage: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  summaryCount: { color: colors.muted, fontSize: 10 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  empty: { padding: 17, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyStar: { color: "#C58B28", fontSize: 29 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 4, marginBottom: 5, textAlign: "center" },
  reviewCard: { padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 9 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  reviewer: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  date: { color: colors.muted, fontSize: 10, marginTop: 2 },
  reviewStars: { color: "#C58B28", fontSize: 12, letterSpacing: 0.2 },
  reviewTitle: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 11 },
  reviewBody: { color: colors.ink, fontSize: 12, lineHeight: 19, marginTop: 6 },
  ownReviewRow: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ownReviewLabel: { color: colors.accent, fontSize: 11, fontWeight: "800" },
  editAction: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  pendingCard: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, marginTop: 4, marginBottom: 10 },
  pendingTitle: { color: colors.primary, fontSize: 13, fontWeight: "800", marginBottom: 4 },
  formCard: { backgroundColor: colors.surface, padding: 15, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  formTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  formIntro: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 12 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: "800", marginTop: 12, marginBottom: 6 },
  ratingPicker: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingStar: { color: "#C58B28", fontSize: 27 },
  ratingStarSelected: { color: "#C58B28" },
  ratingValue: { color: colors.muted, fontSize: 11, marginLeft: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, color: colors.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  multiline: { minHeight: 110, marginTop: 0 },
  note: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 11 }
};
