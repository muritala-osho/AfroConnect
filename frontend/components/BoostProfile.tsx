import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useApi } from '../hooks/useApi';
import * as Haptics from 'expo-haptics';

interface BoostPackage {
  id: string;
  name: string;
  durationMinutes: number;
  multiplier: number;
  description: string;
}

interface ActiveBoost {
  id: string;
  type: string;
  multiplier: number;
  startedAt: string;
  expiresAt: string;
  remainingMinutes: number;
  viewsGained: number;
  likesGained: number;
  matchesGained: number;
}

interface BoostProfileProps {
  onBoostActivated?: () => void;
}

const { width } = Dimensions.get('window');

export const BoostProfile: React.FC<BoostProfileProps> = ({ onBoostActivated }) => {
  const { colors } = useTheme();
  const api = useApi();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [packages, setPackages] = useState<BoostPackage[]>([]);
  const [activeBoost, setActiveBoost] = useState<ActiveBoost | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchBoostStatus();
    fetchPackages();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeBoost) {
      startPulseAnimation();
      startTimer();
    } else {
      pulseAnim.setValue(1);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [activeBoost]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          fetchBoostStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 60000); // Update every minute
  };

  const fetchBoostStatus = async () => {
    try {
      const response = await api.get('/api/boost/status');
      if (response.success && response.hasActiveBoost) {
        setActiveBoost(response.boost);
        setRemainingTime(response.boost.remainingMinutes);
      } else {
        setActiveBoost(null);
        setRemainingTime(0);
      }
    } catch (err) {
      console.error('Failed to fetch boost status:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await api.get('/api/boost/packages');
      if (response.success) {
        setPackages(response.packages);
      }
    } catch (err) {
      console.error('Failed to fetch boost packages:', err);
    }
  };

  const handleActivateBoost = async () => {
    if (!selectedPackage) return;

    try {
      setActivating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const response = await api.post('/api/boost/activate', {
        type: selectedPackage
      });
      
      if (response.success) {
        await fetchBoostStatus();
        setModalVisible(false);
        onBoostActivated?.();
      }
    } catch (err) {
      console.error('Failed to activate boost:', err);
    } finally {
      setActivating(false);
    }
  };

  const handleCancelBoost = async () => {
    try {
      setLoading(true);
      const response = await api.delete('/api/boost/cancel');
      if (response.success) {
        setActiveBoost(null);
        setRemainingTime(0);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error('Failed to cancel boost:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const getPackageColor = (packageId: string) => {
    switch (packageId) {
      case 'premium': return '#FFD700';
      case 'super': return '#9C27B0';
      default: return colors.primary;
    }
  };

  // Active boost indicator (compact view)
  if (activeBoost) {
    return (
      <TouchableOpacity
        style={[styles.activeBoostContainer, { backgroundColor: colors.primary + '20' }]}
        onPress={() => setModalVisible(true)}
      >
        <Animated.View style={[styles.boostIconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="flash" size={24} color={colors.primary} />
        </Animated.View>
        <View style={styles.activeBoostInfo}>
          <Text style={[styles.activeBoostTitle, { color: colors.primary }]}>
            Boost Active
          </Text>
          <Text style={[styles.activeBoostTime, { color: colors.textSecondary }]}>
            {formatTime(remainingTime || activeBoost.remainingMinutes)} remaining
          </Text>
        </View>
        <View style={styles.activeBoostStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {activeBoost.viewsGained}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {activeBoost.likesGained}
            </Text>
          </View>
        </View>

        {/* Modal for boost details */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Boost Active
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.boostCard, { backgroundColor: colors.primary + '15' }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Ionicons name="flash" size={48} color={colors.primary} />
                </Animated.View>
                <Text style={[styles.boostType, { color: colors.text }]}>
                  {activeBoost.type.charAt(0).toUpperCase() + activeBoost.type.slice(1)} Boost
                </Text>
                <Text style={[styles.multiplierText, { color: colors.primary }]}>
                  {activeBoost.multiplier}x Visibility
                </Text>
                <Text style={[styles.timeRemaining, { color: colors.textSecondary }]}>
                  {formatTime(remainingTime || activeBoost.remainingMinutes)} remaining
                </Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="eye" size={24} color="#2196F3" />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {activeBoost.viewsGained}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Views
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="heart" size={24} color="#E91E63" />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {activeBoost.likesGained}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Likes
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="people" size={24} color="#4CAF50" />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {activeBoost.matchesGained}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Matches
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.error }]}
                onPress={handleCancelBoost}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={[styles.cancelButtonText, { color: colors.error }]}>
                    Cancel Boost
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </TouchableOpacity>
    );
  }

  // Boost button (when no active boost)
  return (
    <>
      <TouchableOpacity
        style={[styles.boostButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
      >
        <Ionicons name="flash" size={20} color="#fff" />
        <Text style={styles.boostButtonText}>Boost Profile</Text>
      </TouchableOpacity>

      {/* Package selection modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Boost Your Profile
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Get more visibility and matches by boosting your profile
            </Text>

            <View style={styles.packagesContainer}>
              {packages.map(pkg => {
                const isSelected = selectedPackage === pkg.id;
                const pkgColor = getPackageColor(pkg.id);
                
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.packageCard,
                      {
                        backgroundColor: isSelected ? pkgColor + '15' : colors.card,
                        borderColor: isSelected ? pkgColor : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPackage(pkg.id);
                    }}
                  >
                    {pkg.id === 'premium' && (
                      <View style={[styles.popularBadge, { backgroundColor: pkgColor }]}>
                        <Text style={styles.popularBadgeText}>BEST</Text>
                      </View>
                    )}
                    <Ionicons
                      name="flash"
                      size={32}
                      color={isSelected ? pkgColor : colors.textSecondary}
                    />
                    <Text style={[styles.packageName, { color: colors.text }]}>
                      {pkg.name}
                    </Text>
                    <Text style={[styles.packageMultiplier, { color: pkgColor }]}>
                      {pkg.multiplier}x
                    </Text>
                    <Text style={[styles.packageDuration, { color: colors.textSecondary }]}>
                      {pkg.durationMinutes} minutes
                    </Text>
                    {isSelected && (
                      <View style={[styles.selectedCheck, { backgroundColor: pkgColor }]}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.benefitsBox, { backgroundColor: colors.card }]}>
              <Text style={[styles.benefitsTitle, { color: colors.text }]}>
                Boost Benefits
              </Text>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
                  Appear at the top of discovery
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
                  Get more profile views
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
                  Increase your match rate
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.activateButton,
                {
                  backgroundColor: selectedPackage ? colors.primary : colors.border,
                  opacity: activating ? 0.7 : 1,
                },
              ]}
              onPress={handleActivateBoost}
              disabled={!selectedPackage || activating}
            >
              {activating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={20} color="#fff" />
                  <Text style={styles.activateButtonText}>
                    {selectedPackage ? 'Activate Boost' : 'Select a Package'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Boosted indicator badge for discovery cards
interface BoostedBadgeProps {
  multiplier?: number;
}

export const BoostedBadge: React.FC<BoostedBadgeProps> = ({ multiplier = 2 }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.boostedBadge, { backgroundColor: colors.primary }]}>
      <Ionicons name="flash" size={12} color="#fff" />
      <Text style={styles.boostedBadgeText}>Boosted</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  boostButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeBoostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
  },
  boostIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBoostInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activeBoostTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeBoostTime: {
    fontSize: 12,
    marginTop: 2,
  },
  activeBoostStats: {
    flexDirection: 'row',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  statText: {
    fontSize: 12,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  packagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  packageCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginHorizontal: 4,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  packageName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  packageMultiplier: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  packageDuration: {
    fontSize: 11,
    marginTop: 4,
  },
  selectedCheck: {
    position: 'absolute',
    bottom: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitsBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    marginLeft: 10,
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
  },
  activateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  boostCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  boostType: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  multiplierText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  timeRemaining: {
    fontSize: 14,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  boostedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  boostedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default BoostProfile;
