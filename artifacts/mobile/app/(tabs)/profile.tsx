import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { streak, totalXP, totalSessions } = useApp();

  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const level = Math.floor(totalXP / 500) + 1;

  const handleReset = () => {
    Alert.alert(
      "Reset Progress",
      "This will erase all your game history and scores. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("@neurofit_data_v1");
            Alert.alert("Done", "Restart the app to see the changes.");
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Profile
        </Text>
      </View>

      {/* Avatar + name */}
      <View
        style={[
          styles.avatarCard,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View
          style={[styles.avatar, { backgroundColor: colors.primary + "26" }]}
        >
          <Text style={[styles.avatarInitial, { color: colors.primary }]}>
            NF
          </Text>
        </View>
        <View style={styles.avatarInfo}>
          <Text style={[styles.avatarName, { color: colors.foreground }]}>
            NeuroFit User
          </Text>
          <View
            style={[
              styles.levelBadge,
              { backgroundColor: colors.primary + "26" },
            ]}
          >
            <Feather name="award" size={12} color={colors.primary} />
            <Text style={[styles.levelBadgeText, { color: colors.primary }]}>
              Level {level} Brain Athlete
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: "Streak", value: `${streak}d`, color: "#F59E0B", icon: "zap" as const },
          { label: "Total XP", value: totalXP.toLocaleString(), color: colors.primary, icon: "star" as const },
          { label: "Sessions", value: String(totalSessions), color: "#10B981", icon: "activity" as const },
        ].map((s) => (
          <View
            key={s.label}
            style={[
              styles.statBox,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name={s.icon} size={16} color={s.color} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {s.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Settings */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        SETTINGS
      </Text>
      <View
        style={[
          styles.settingsCard,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <View
              style={[
                styles.settingIcon,
                { backgroundColor: colors.primary + "26" },
              ]}
            >
              <Feather name="smartphone" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                Haptic Feedback
              </Text>
              <Text
                style={[
                  styles.settingDesc,
                  { color: colors.mutedForeground },
                ]}
              >
                Vibration on interactions
              </Text>
            </View>
          </View>
          <Switch
            value={hapticsEnabled}
            onValueChange={(v) => {
              setHapticsEnabled(v);
              if (v) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View
              style={[
                styles.settingIcon,
                { backgroundColor: "#10B981" + "26" },
              ]}
            >
              <Feather name="volume-2" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.settingName, { color: colors.foreground }]}>
                Sound Effects
              </Text>
              <Text
                style={[
                  styles.settingDesc,
                  { color: colors.mutedForeground },
                ]}
              >
                Coming soon
              </Text>
            </View>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: colors.border, true: "#10B981" }}
            thumbColor="#fff"
            disabled
          />
        </View>
      </View>

      {/* About */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        ABOUT
      </Text>
      <View
        style={[
          styles.settingsCard,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
          },
        ]}
      >
        {[
          { label: "App Version", value: "1.0.0", icon: "info" as const },
          { label: "Games Available", value: "4", icon: "grid" as const },
        ].map((item, i, arr) => (
          <View
            key={item.label}
            style={[
              styles.aboutRow,
              {
                borderBottomColor: colors.border,
                borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
          >
            <Feather name={item.icon} size={14} color={colors.mutedForeground} />
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>
              {item.label}
            </Text>
            <Text
              style={[styles.aboutValue, { color: colors.mutedForeground }]}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Reset */}
      <Pressable
        style={({ pressed }) => [
          styles.resetBtn,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
            opacity: pressed ? 0.75 : 1,
            borderWidth: 1,
            borderColor: colors.destructive + "40",
          },
        ]}
        onPress={handleReset}
      >
        <Feather name="trash-2" size={16} color={colors.destructive} />
        <Text style={[styles.resetText, { color: colors.destructive }]}>
          Reset All Progress
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 30, fontFamily: "Inter_700Bold" },
  avatarCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontFamily: "Inter_700Bold" },
  avatarInfo: { gap: 8 },
  avatarName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  levelBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginHorizontal: 20,
    marginTop: 4,
  },
  settingsCard: { marginBottom: 24, overflow: "hidden" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  settingName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  settingDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  aboutLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  aboutValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    marginTop: 8,
  },
  resetText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
