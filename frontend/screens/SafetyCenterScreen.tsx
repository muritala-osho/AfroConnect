import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface EmergencyContact {
  name: string;
  description: string;
  phone: string;
  icon: string;
}

interface SafetyTip {
  title: string;
  description: string;
  icon: string;
}

const emergencyContacts: EmergencyContact[] = [
  {
    name: 'Emergency Services',
    description: 'For immediate danger or emergencies',
    phone: '911',
    icon: 'call',
  },
  {
    name: 'National Domestic Violence Hotline',
    description: '24/7 support for domestic violence',
    phone: '1-800-799-7233',
    icon: 'heart',
  },
  {
    name: 'RAINN Hotline',
    description: 'Sexual assault support hotline',
    phone: '1-800-656-4673',
    icon: 'shield',
  },
  {
    name: 'Crisis Text Line',
    description: 'Text HOME to 741741',
    phone: '741741',
    icon: 'chatbubble',
  },
];

const safetyTips: SafetyTip[] = [
  {
    title: 'Meet in Public',
    description: 'For first dates, always choose a public place like a coffee shop or restaurant. Avoid private locations.',
    icon: 'location',
  },
  {
    title: 'Tell Someone',
    description: 'Share your date plans with a trusted friend or family member, including where you are going and when.',
    icon: 'people',
  },
  {
    title: 'Stay Sober',
    description: 'Keep your alcohol consumption to a minimum on first dates to stay alert and in control.',
    icon: 'wine-outline',
  },
  {
    title: 'Use Your Own Transportation',
    description: 'Drive yourself or use a rideshare app so you can leave whenever you want.',
    icon: 'car',
  },
  {
    title: 'Video Chat First',
    description: 'Before meeting in person, have a video call to verify the person matches their profile.',
    icon: 'videocam',
  },
  {
    title: 'Trust Your Instincts',
    description: 'If something feels off, it probably is. Do not hesitate to end the date and leave.',
    icon: 'alert-circle',
  },
  {
    title: 'Protect Personal Information',
    description: 'Do not share your home address, workplace, or financial information early on.',
    icon: 'lock-closed',
  },
  {
    title: 'Check Their Profile',
    description: 'Look for verified profiles and check if their photos seem authentic before meeting.',
    icon: 'checkmark-circle',
  },
];

export default function SafetyCenterScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const handleCallEmergency = (contact: EmergencyContact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (contact.phone === '741741') {
      Alert.alert(
        'Crisis Text Line',
        'Text HOME to 741741 to connect with a trained crisis counselor.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Messages', onPress: () => Linking.openURL('sms:741741') },
        ]
      );
    } else {
      Alert.alert(
        `Call ${contact.name}?`,
        `This will dial ${contact.phone}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call', onPress: () => Linking.openURL(`tel:${contact.phone}`) },
        ]
      );
    }
  };

  const toggleTip = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedTip(expandedTip === index ? null : index);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Safety Center</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#4CAF50', '#2E7D32']}
            style={styles.iconGradient}
          >
            <Ionicons name="shield-checkmark-outline" size={48} color="#FFF" />
          </LinearGradient>
        </View>

        <ThemedText style={styles.title}>Your Safety Matters</ThemedText>
        <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
          We are committed to keeping you safe. Find resources, tips, and emergency contacts here.
        </ThemedText>

        <View style={styles.emergencySection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={20} color="#F44336" />
            <ThemedText style={styles.sectionTitle}>Emergency Contacts</ThemedText>
          </View>
          
          {emergencyContacts.map((contact, index) => (
            <Pressable
              key={index}
              style={[styles.emergencyCard, { backgroundColor: theme.card || theme.surface }]}
              onPress={() => handleCallEmergency(contact)}
            >
              <View style={[styles.emergencyIcon, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
                <Ionicons name={contact.icon as any} size={24} color="#F44336" />
              </View>
              <View style={styles.emergencyInfo}>
                <ThemedText style={styles.emergencyName}>{contact.name}</ThemedText>
                <ThemedText style={[styles.emergencyDescription, { color: theme.textSecondary }]}>
                  {contact.description}
                </ThemedText>
              </View>
              <View style={styles.emergencyAction}>
                <Ionicons name="call" size={20} color={theme.primary} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.tipsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={20} color={theme.primary} />
            <ThemedText style={styles.sectionTitle}>Dating Safety Tips</ThemedText>
          </View>
          
          {safetyTips.map((tip, index) => (
            <Pressable
              key={index}
              style={[styles.tipCard, { backgroundColor: theme.card || theme.surface }]}
              onPress={() => toggleTip(index)}
            >
              <View style={styles.tipHeader}>
                <View style={[styles.tipIcon, { backgroundColor: `${theme.primary}20` }]}>
                  <Ionicons name={tip.icon as any} size={20} color={theme.primary} />
                </View>
                <ThemedText style={styles.tipTitle}>{tip.title}</ThemedText>
                <Ionicons
                  name={expandedTip === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.textSecondary}
                />
              </View>
              {expandedTip === index && (
                <ThemedText style={[styles.tipDescription, { color: theme.textSecondary }]}>
                  {tip.description}
                </ThemedText>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.reportSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag" size={20} color="#FF9800" />
            <ThemedText style={styles.sectionTitle}>Report & Block</ThemedText>
          </View>
          
          <View style={[styles.reportCard, { backgroundColor: theme.card || theme.surface }]}>
            <ThemedText style={styles.reportTitle}>Encountered inappropriate behavior?</ThemedText>
            <ThemedText style={[styles.reportDescription, { color: theme.textSecondary }]}>
              You can report users directly from their profile or from your chat. Reports are anonymous and our team reviews each case carefully.
            </ThemedText>
            
            <View style={styles.reportActions}>
              <View style={styles.reportAction}>
                <Ionicons name="flag-outline" size={24} color={theme.primary} />
                <ThemedText style={[styles.reportActionText, { color: theme.textSecondary }]}>
                  Report from profile or chat
                </ThemedText>
              </View>
              <View style={styles.reportAction}>
                <Ionicons name="ban-outline" size={24} color={theme.primary} />
                <ThemedText style={[styles.reportActionText, { color: theme.textSecondary }]}>
                  Block to prevent contact
                </ThemedText>
              </View>
              <View style={styles.reportAction}>
                <Ionicons name="eye-off-outline" size={24} color={theme.primary} />
                <ThemedText style={[styles.reportActionText, { color: theme.textSecondary }]}>
                  Hide your profile from them
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.resourcesSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book" size={20} color={theme.primary} />
            <ThemedText style={styles.sectionTitle}>Additional Resources</ThemedText>
          </View>

          <Pressable
            style={[styles.resourceCard, { backgroundColor: theme.card || theme.surface }]}
            onPress={() => Linking.openURL('https://www.staysafeonline.org')}
          >
            <Ionicons name="globe-outline" size={24} color={theme.primary} />
            <View style={styles.resourceInfo}>
              <ThemedText style={styles.resourceTitle}>Online Safety Resources</ThemedText>
              <ThemedText style={[styles.resourceDescription, { color: theme.textSecondary }]}>
                Learn more about staying safe online
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.disclaimer, { backgroundColor: 'rgba(158, 158, 158, 0.1)' }]}>
          <Ionicons name="information-circle" size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.disclaimerText, { color: theme.textSecondary }]}>
            If you are in immediate danger, please contact local emergency services right away. This app is not a substitute for professional help.
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emergencySection: {
    marginBottom: 32,
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: 13,
  },
  emergencyAction: {
    padding: 8,
  },
  tipsSection: {
    marginBottom: 32,
  },
  tipCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  tipDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    paddingLeft: 48,
  },
  reportSection: {
    marginBottom: 32,
  },
  reportCard: {
    padding: 16,
    borderRadius: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  reportDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  reportActions: {
    gap: 12,
  },
  reportAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportActionText: {
    fontSize: 14,
    flex: 1,
  },
  resourcesSection: {
    marginBottom: 24,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 13,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
