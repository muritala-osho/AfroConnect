import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface PriceTier {
  id: string;
  interval: 'day' | 'week' | 'month' | 'year';
  amount: number;
  currency: string;
  label: string;
  savings?: string;
  popular?: boolean;
}

const PRICING_TIERS: PriceTier[] = [
  { id: 'price_daily', interval: 'day', amount: 299, currency: 'USD', label: 'Daily', savings: undefined },
  { id: 'price_weekly', interval: 'week', amount: 999, currency: 'USD', label: 'Weekly', savings: 'Save 52%' },
  { id: 'price_monthly', interval: 'month', amount: 1999, currency: 'USD', label: 'Monthly', savings: 'Save 67%', popular: true },
  { id: 'price_yearly', interval: 'year', amount: 9999, currency: 'USD', label: 'Yearly', savings: 'Save 86%' },
];

const PREMIUM_FEATURES = [
  { icon: 'heart-multiple', text: 'Unlimited Likes', color: '#FF6B6B' },
  { icon: 'eye', text: 'See Who Likes You', color: '#4CAF50' },
  { icon: 'lightning-bolt', text: '5 Super Likes Daily', color: '#FFD93D' },
  { icon: 'undo-variant', text: 'Unlimited Rewinds', color: '#9C27B0' },
  { icon: 'incognito', text: 'Incognito Mode', color: '#607D8B' },
  { icon: 'rocket-launch', text: '1 Free Boost Monthly', color: '#FF9800' },
  { icon: 'earth', text: 'Passport - Match Anywhere', color: '#2196F3' },
  { icon: 'phone', text: 'Unlimited Calls', color: '#00BCD4' },
];

export default function PremiumScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { get, post } = useApi();
  
  const [selectedTier, setSelectedTier] = useState<PriceTier>(PRICING_TIERS[2]);
  const [processing, setProcessing] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const cardScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 1500 }),
      withTiming(0.5, { duration: 1500 })
    );
    const interval = setInterval(() => {
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.5, { duration: 1500 })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [token]);

  const checkSubscriptionStatus = async () => {
    if (!token) return;
    try {
      const response = await get<{ subscription: { isActive: boolean } }>('/subscription/status', token);
      if (response.success && response.data?.subscription?.isActive) {
        setIsActive(true);
      }
    } catch (e) {}
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleSubscribe = async () => {
    if (!token) {
      Alert.alert('Login Required', 'Please log in to subscribe.');
      return;
    }

    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    }

    setProcessing(true);
    try {
      const response = await post<{ url?: string }>(
        '/subscription/create-checkout',
        { priceId: selectedTier.id, interval: selectedTier.interval },
        token
      );

      if (response.success && response.data?.url) {
        Linking.openURL(response.data.url);
      } else {
        Alert.alert('Success!', `You selected the ${selectedTier.label} plan at ${formatPrice(selectedTier.amount, selectedTier.currency)}. Stripe checkout will open once configured.`);
      }
    } catch (error) {
      Alert.alert('Info', `Selected: ${selectedTier.label} plan at ${formatPrice(selectedTier.amount, selectedTier.currency)}/${selectedTier.interval}`);
    } finally {
      setProcessing(false);
    }
  };

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSection}>
            <Animated.View style={[styles.heroGlow, glowStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255, 107, 107, 0.3)', 'transparent']}
                style={styles.glowGradient}
              />
            </Animated.View>
            
            <View style={styles.crownContainer}>
              <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.crownBg}>
                <MaterialCommunityIcons name="crown" size={40} color="#FFF" />
              </LinearGradient>
            </View>
            
            <Text style={styles.heroTitle}>Upgrade to Premium</Text>
            <Text style={styles.heroSubtitle}>
              Get unlimited access to all features and find your perfect match faster
            </Text>
          </View>

          {isActive && (
            <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.activeBanner}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#FFF" />
              <Text style={styles.activeBannerText}>You're a Premium Member!</Text>
            </LinearGradient>
          )}

          <Text style={styles.sectionLabel}>Choose Your Plan</Text>
          
          <View style={styles.tiersContainer}>
            {PRICING_TIERS.map((tier) => {
              const isSelected = selectedTier.id === tier.id;
              return (
                <TouchableOpacity
                  key={tier.id}
                  activeOpacity={0.8}
                  style={[
                    styles.tierCard,
                    isSelected && styles.tierCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedTier(tier);
                    if (Platform.OS !== 'web') {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                    }
                  }}
                >
                  {tier.popular && (
                    <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </LinearGradient>
                  )}
                  
                  {tier.savings && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>{tier.savings}</Text>
                    </View>
                  )}
                  
                  <View style={styles.tierContent}>
                    <View style={styles.tierLeft}>
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View>
                        <Text style={[styles.tierLabel, isSelected && styles.tierLabelSelected]}>
                          {tier.label}
                        </Text>
                        <Text style={styles.tierInterval}>
                          Billed {tier.interval === 'day' ? 'daily' : tier.interval === 'year' ? 'annually' : tier.interval + 'ly'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.tierRight}>
                      <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                        {formatPrice(tier.amount, tier.currency)}
                      </Text>
                      <Text style={styles.tierPer}>/{tier.interval}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Premium Features</Text>
          
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                  <MaterialCommunityIcons name={feature.icon as any} size={22} color={feature.color} />
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.guaranteeSection}>
            <MaterialCommunityIcons name="shield-check" size={32} color="#4CAF50" />
            <View style={styles.guaranteeText}>
              <Text style={styles.guaranteeTitle}>30-Day Money Back Guarantee</Text>
              <Text style={styles.guaranteeDesc}>
                Not satisfied? Get a full refund within 30 days, no questions asked.
              </Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.bottomCta}>
          <LinearGradient
            colors={['transparent', 'rgba(26, 26, 46, 0.95)', '#1a1a2e']}
            style={styles.bottomGradient}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.subscribeButton}
              onPress={handleSubscribe}
              disabled={processing || isActive}
            >
              <LinearGradient
                colors={isActive ? ['#4CAF50', '#2E7D32'] : ['#FF6B6B', '#FF8E53']}
                style={styles.subscribeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.subscribeText}>
                      {isActive ? 'Already Premium' : `Get Premium - ${formatPrice(selectedTier.amount, selectedTier.currency)}/${selectedTier.interval}`}
                    </Text>
                    {!isActive && <Feather name="arrow-right" size={20} color="#FFF" />}
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <Text style={styles.termsText}>
              By subscribing, you agree to our Terms of Service. Cancel anytime.
            </Text>
          </LinearGradient>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    width: 300,
    height: 200,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 150,
  },
  crownContainer: {
    marginBottom: 20,
  },
  crownBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 10,
  },
  activeBannerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
    marginTop: 10,
  },
  tiersContainer: {
    gap: 12,
    marginBottom: 24,
  },
  tierCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  tierCardSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  popularBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  savingsBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savingsBadgeText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '700',
  },
  tierContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FF6B6B',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
  },
  tierLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  tierLabelSelected: {
    color: '#FF6B6B',
  },
  tierInterval: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  tierRight: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  tierPriceSelected: {
    color: '#FF6B6B',
  },
  tierPer: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  featureItem: {
    width: (width - 52) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  guaranteeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  guaranteeText: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  guaranteeDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  subscribeText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  termsText: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
});
