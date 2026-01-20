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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface Plan {
  id: string;
  name: string;
  description: string;
  planKey: string;
  info: {
    name: string;
    description: string;
    features: string[];
  };
  prices: Array<{
    id: string;
    amount: number;
    currency: string;
    interval: string;
  }>;
}

interface SubscriptionStatus {
  isActive: boolean;
  plan: string;
  expiresAt?: string;
  features: Record<string, any>;
}

const PLAN_COLORS: Record<string, string[]> = {
  plus: ['#3B82F6', '#2563EB'],
  gold: ['#F59E0B', '#D97706'],
  platinum: ['#8B5CF6', '#7C3AED'],
};

const PLAN_ICONS: Record<string, string> = {
  plus: 'star',
  gold: 'diamond',
  platinum: 'rocket',
};

const PREMIUM_FEATURES = [
  { icon: 'phone-classic' as any, text: 'Unlimited Voice & Video Calls', desc: 'No more 5-minute limits' },
  { icon: 'eye' as any, text: 'See Who Likes You', desc: 'Match instantly with people who already like you' },
  { icon: 'shield-check' as any, text: 'Premium Badge', desc: 'Exclusive gold star badge on your profile' },
  { icon: 'eye-off' as any, text: 'Incognito Mode', desc: 'Hide your profile and only be seen by people you like' },
  { icon: 'map-marker' as any, text: 'Passport', desc: 'Match with people anywhere in the world' },
  { icon: 'zap' as any, text: '1 Boost per month', desc: 'Be the top profile in your area for 30 minutes' },
  { icon: 'history' as any, text: 'Unlimited Rewinds', desc: 'Accidentally swiped left? Bring them back!' },
  { icon: 'heart' as any, text: '5 Super Likes per day', desc: 'Stand out from the crowd' },
];

export default function PremiumScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { get, post } = useApi();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setFetchError('Please log in to view premium plans');
      return;
    }
    
    setFetchError(null);
    try {
      const [plansRes, statusRes] = await Promise.all([
        get<{ plans: Plan[] }>('/subscription/plans', token),
        get<{ subscription: SubscriptionStatus }>('/subscription/status', token),
      ]);

      if (plansRes.success && plansRes.data) {
        setPlans((plansRes.data as any).plans || []);
      } else {
        setFetchError('Unable to load subscription plans');
      }
      if (statusRes.success && statusRes.data) {
        setStatus((statusRes.data as any).subscription);
      }
    } catch (error) {
      console.error('Error fetching premium data:', error);
      setFetchError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [get, token]);

  const hasInitiallyLoaded = useRef(false);
  const prevTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      hasInitiallyLoaded.current = false;
      prevTokenRef.current = null;
      setLoading(false);
      setFetchError('Please log in to view premium plans');
      return;
    }
    
    if (!hasInitiallyLoaded.current || prevTokenRef.current !== token) {
      hasInitiallyLoaded.current = true;
      prevTokenRef.current = token;
      fetchData();
    }
  }, [token, fetchData]);

  const handleSubscribe = async (priceId: string, planKey: string) => {
    if (!token) {
      Alert.alert('Login Required', 'Please log in to subscribe to a plan.');
      return;
    }
    
    if (Platform.OS !== 'web') {
      try {
        (Haptics as any).impactAsync((Haptics as any).ImpactFeedbackStyle.Medium);
      } catch (e) {}
    }
    
    setProcessingPlan(planKey);
    try {
      const response = await post<{ url?: string; sessionId?: string }>(
        '/subscription/create-checkout',
        { priceId },
        token
      );

      if (response.success && response.data) {
        if (response.data.url) {
          Linking.openURL(response.data.url);
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to start checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const renderCurrentPlan = () => {
    if (!status?.isActive) return null;
    
    return (
      <LinearGradient
        colors={['#1a1a1a', '#000']}
        style={styles.currentPlanBox}
      >
        <View style={styles.currentPlanHeader}>
          <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>ACTIVE</Text>
          </LinearGradient>
          <Text style={[styles.currentPlanTitle, { color: '#FFF' }]}>
            AfroConnect {status.plan.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.expiresText, { color: 'rgba(255,255,255,0.6)' }]}>
          Renews/Expires: {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : 'N/A'}
        </Text>
      </LinearGradient>
    );
  };

  const renderPlanCard = (plan: Plan) => {
    const planGradients: [string, string, ...string[]] = (PLAN_COLORS[plan.planKey] as [string, string, ...string[]]) || [theme.primary, theme.primary];
    const isCurrentPlan = status?.isActive && status.plan === plan.planKey;
    const isProcessing = processingPlan === plan.planKey;
    
    const monthlyPrice = plan.prices.find(p => p.interval === 'month');
    const yearlyPrice = plan.prices.find(p => p.interval === 'year');
    const weeklyPrice = plan.prices.find(p => p.interval === 'week');
    const dailyPrice = plan.prices.find(p => p.interval === 'day');

    let selectedPrice = monthlyPrice;
    if (selectedInterval === 'year') selectedPrice = yearlyPrice;
    if (selectedInterval === 'week') selectedPrice = weeklyPrice;
    if (selectedInterval === 'day') selectedPrice = dailyPrice;

    return (
      <View 
        key={plan.id} 
        style={[
          styles.planCard, 
          { 
            backgroundColor: theme.surface, 
            borderColor: isCurrentPlan ? planGradients[0] : theme.border,
            borderWidth: isCurrentPlan ? 2 : 1,
          }
        ]}
      >
        <View style={styles.planHeader}>
          <LinearGradient colors={planGradients} style={styles.planIcon}>
            <MaterialCommunityIcons name={PLAN_ICONS[plan.planKey] as any || 'star'} size={28} color="#FFF" />
          </LinearGradient>
          <View style={styles.planTitleContainer}>
            <Text style={[styles.planName, { color: theme.text }]}>{plan.info.name || plan.name}</Text>
            <Text style={[styles.planDesc, { color: theme.textSecondary }]}>{plan.info.description}</Text>
          </View>
        </View>

        {selectedPrice && (
          <View style={styles.priceContainer}>
            <Text style={[styles.priceAmount, { color: planGradients[0] }]}>
              {formatPrice(selectedPrice.amount, selectedPrice.currency)}
            </Text>
            <Text style={[styles.priceInterval, { color: theme.textSecondary }]}>
              /{selectedInterval === 'month' ? 'mo' : selectedInterval === 'year' ? 'yr' : selectedInterval === 'week' ? 'wk' : 'day'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.subscribeButton, (isCurrentPlan || isProcessing) && { opacity: 0.6 }]}
          onPress={() => !isCurrentPlan && !isProcessing && selectedPrice && handleSubscribe(selectedPrice.id, plan.planKey)}
          disabled={isProcessing || isCurrentPlan}
        >
          <LinearGradient colors={planGradients} style={styles.buttonGradient}>
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.subscribeButtonText}>{isCurrentPlan ? 'Current Plan' : 'Get Started'}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>AfroConnect Premium</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.heroBadge}>
            <MaterialCommunityIcons name="star" size={14} color="#FFF" />
            <Text style={styles.heroBadgeText}>ELITE STATUS</Text>
          </LinearGradient>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Unlock Your Best Matches</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>Get exclusive features and stand out from the crowd.</Text>
        </View>

        {renderCurrentPlan()}

        <View style={[styles.intervalToggle, { backgroundColor: theme.surface }]}>
          {['day', 'week', 'month', 'year'].map((interval) => (
            <TouchableOpacity
              key={interval}
              style={[
                styles.intervalButton,
                selectedInterval === interval && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSelectedInterval(interval as any)}
            >
              <Text style={[
                styles.intervalText,
                { color: selectedInterval === interval ? '#fff' : theme.text }
              ]}>
                {interval.charAt(0).toUpperCase() + interval.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.plansSection}>
          {fetchError ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={40} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>{fetchError}</Text>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={fetchData}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : plans.length > 0 ? (
            plans.map(renderPlanCard)
          ) : (
            <View style={styles.noPlansContainer}>
              <Text style={[styles.noPlansText, { color: theme.textSecondary }]}>No plans available at the moment.</Text>
            </View>
          )}
        </View>

        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>What's Included</Text>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View key={index} style={[styles.featureCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.featureIconContainer, { backgroundColor: theme.primary + '15' }]}>
                <MaterialCommunityIcons name={feature.icon as any} size={20} color={theme.primary} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>{feature.text}</Text>
                <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>{feature.desc}</Text>
              </View>
              {feature.icon === 'shield-check' && (
                <View style={styles.badgePreview}>
                  <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  heroSection: { alignItems: 'center', marginBottom: 30 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12, gap: 6 },
  heroBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 16, textAlign: 'center', opacity: 0.7, paddingHorizontal: 20 },
  currentPlanBox: { padding: 20, borderRadius: 20, marginBottom: 24, overflow: 'hidden' },
  currentPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  activeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  currentPlanTitle: { fontSize: 20, fontWeight: '800' },
  expiresText: { fontSize: 13 },
  intervalToggle: { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 30 },
  intervalButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  intervalText: { fontSize: 14, fontWeight: '700' },
  plansSection: { marginBottom: 30 },
  planCard: { borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1 },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  planIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  planTitleContainer: { flex: 1 },
  planName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  planDesc: { fontSize: 14, opacity: 0.7 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  priceAmount: { fontSize: 36, fontWeight: '900' },
  priceInterval: { fontSize: 16, marginLeft: 4, opacity: 0.6 },
  subscribeButton: { width: '100%', height: 56, borderRadius: 16, overflow: 'hidden' },
  buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subscribeButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  featuresSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  featureCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12 },
  featureIconContainer: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  featureInfo: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  featureDesc: { fontSize: 13, opacity: 0.6 },
  badgePreview: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 215, 0, 0.15)', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  errorContainer: { alignItems: 'center', padding: 30 },
  errorText: { marginTop: 12, textAlign: 'center', marginBottom: 20 },
  retryButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { color: '#FFF', fontWeight: '700' },
  noPlansContainer: { alignItems: 'center', padding: 30 },
  noPlansText: { textAlign: 'center' }
});
