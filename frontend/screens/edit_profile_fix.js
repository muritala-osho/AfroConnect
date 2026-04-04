const fs = require('fs');
const content = fs.readFileSync('frontend/screens/EditProfileScreen.tsx', 'utf8');

// Find the main component return: it's the one followed by <View style={[styles.container
// Find all occurrences and pick the FIRST one that has the container view
let idx = 0;
let mainReturnPos = -1;
while ((idx = content.indexOf('  return (', idx)) !== -1) {
  const after = content.substring(idx, idx + 120);
  if (after.includes('<View style={[styles.container')) {
    mainReturnPos = idx;
    break; // take the first one (original main component)
  }
  idx++;
}

if (mainReturnPos === -1) {
  console.error('Could not find main component return!');
  process.exit(1);
}

console.log('Main component return found at position:', mainReturnPos);
const before = content.substring(0, mainReturnPos);

const newJSX = `  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <LinearGradient
        colors={isDark
          ? [theme.primary + '28', theme.primary + '08', 'transparent']
          : [theme.primary + '1A', theme.primary + '05', 'transparent']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={[styles.headerBack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</ThemedText>
        <Pressable onPress={handleSave} disabled={saving} style={[styles.headerSaveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather name="check" size={15} color="#FFF" />
              <ThemedText style={styles.headerSaveBtnText}>Save</ThemedText>
            </>
          )}
        </Pressable>
      </LinearGradient>

      {/* HERO */}
      <Pressable onPress={() => navigation.navigate('ChangeProfilePicture')} style={[styles.hero, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.heroLeft}>
          <View style={[styles.heroRing, { borderColor: theme.primary + '60' }]}>
            {user?.photos?.[0] ? (
              <SafeImage source={typeof user.photos[0] === 'string' ? user.photos[0] : user.photos[0].url} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhotoEmpty, { backgroundColor: theme.primary + '18' }]}>
                <Ionicons name="camera" size={28} color={theme.primary} />
              </View>
            )}
            <View style={[styles.heroRingBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
              <Feather name="camera" size={11} color="#FFF" />
            </View>
          </View>
        </View>
        <View style={styles.heroInfo}>
          <ThemedText style={[styles.heroName, { color: theme.text }]} numberOfLines={1}>{name || 'Your Name'}</ThemedText>
          <ThemedText style={[styles.heroSub, { color: theme.textSecondary }]}>Tap to manage photos · {user?.photos?.length || 0}/6</ThemedText>
          <View style={styles.heroBarRow}>
            <View style={[styles.heroBarTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8E8' }]}>
              <View style={[styles.heroBarFill, { width: (completionPct + '%') as any, backgroundColor: completionPct >= 80 ? '#10B981' : theme.primary }]} />
            </View>
            <ThemedText style={[styles.heroBarLabel, { color: completionPct >= 80 ? '#10B981' : theme.primary }]}>{completionPct}%</ThemedText>
          </View>
        </View>
      </Pressable>

      {/* TAB BAR */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {([
          { key: 'profile' as const, label: 'Profile', icon: 'user' as const },
          { key: 'vibes' as const, label: 'Vibes', icon: 'zap' as const },
          { key: 'roots' as const, label: 'Roots', icon: 'globe' as const },
          { key: 'more' as const, label: 'More', icon: 'grid' as const },
        ]).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && { borderBottomColor: theme.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Feather name={tab.icon} size={14} color={activeTab === tab.key ? theme.primary : theme.textSecondary} />
            <ThemedText style={[styles.tabLabel, { color: activeTab === tab.key ? theme.primary : theme.textSecondary, fontWeight: activeTab === tab.key ? '700' : '500' }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* CONTENT */}
      <ScreenKeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={[theme.primary + '28', theme.primary + '10']} style={styles.cardIconWrap}>
                  <Feather name="user" size={16} color={theme.primary} />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Basic Info</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>How others see you</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <InputField label="Full Name *" value={name} onChangeText={setName} placeholder="Your name" icon="user" />
                <InputField label="Bio" value={bio} onChangeText={setBio} placeholder="Tell others about yourself..." multiline icon="edit-3" />
                <View style={styles.row2}>
                  <View style={styles.half}>
                    <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Gender</ThemedText>
                    <SelectButton label="Gender" value={gender} options={GENDER_OPTIONS} onPress={() => setActiveModal('gender')} icon="users" />
                  </View>
                  <View style={styles.half}>
                    <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Height</ThemedText>
                    <SelectButton label="Height" value={height} options={HEIGHT_OPTIONS} onPress={() => setActiveModal('height')} icon="trending-up" />
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#FF6B9D28', '#FF6B9D10']} style={styles.cardIconWrap}>
                  <Feather name="heart" size={16} color="#FF6B9D" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Interests</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>What makes you, you</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Pressable
                  style={[styles.triggerRow, { borderColor: interests.length > 0 ? '#FF6B9D40' : theme.border, backgroundColor: interests.length > 0 ? '#FF6B9D08' : (isDark ? 'rgba(255,255,255,0.04)' : '#F8F8F8') }]}
                  onPress={() => setInterestsModalVisible(true)}
                >
                  <View style={[styles.triggerIcon, { backgroundColor: interests.length > 0 ? '#FF6B9D20' : theme.border + '50' }]}>
                    <Feather name="plus-circle" size={15} color={interests.length > 0 ? '#FF6B9D' : theme.textSecondary} />
                  </View>
                  <ThemedText style={[styles.triggerText, { color: interests.length > 0 ? theme.text : theme.textSecondary }]}>
                    {interests.length > 0 ? interests.length + ' interests selected' : 'Choose your interests'}
                  </ThemedText>
                  <Feather name="chevron-right" size={16} color={interests.length > 0 ? '#FF6B9D' : theme.textSecondary} />
                </Pressable>
                {interests.length > 0 && (
                  <View style={styles.chipsWrap}>
                    {interests.map((id: string) => {
                      const opt = INTEREST_OPTIONS.find(o => o.id === id);
                      return (
                        <View key={id} style={[styles.chip, { backgroundColor: '#FF6B9D12', borderColor: '#FF6B9D30' }]}>
                          {opt && <Ionicons name={opt.icon as any} size={11} color="#FF6B9D" />}
                          <ThemedText style={[styles.chipText, { color: theme.text }]}>{opt?.label || id}</ThemedText>
                          <Pressable onPress={() => toggleInterest(id)} hitSlop={8}>
                            <Feather name="x" size={10} color={theme.textSecondary} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#8B5CF628', '#8B5CF610']} style={styles.cardIconWrap}>
                  <Feather name="target" size={16} color="#8B5CF6" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Dating Preferences</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>What you're looking for</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Looking For</ThemedText>
                  <SelectButton label="What are you seeking?" value={lookingFor} options={LOOKING_FOR_OPTIONS} onPress={() => setActiveModal('lookingFor')} icon="search" accent="#8B5CF6" />
                </View>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Relationship Goal</ThemedText>
                  <SelectButton label="Your goal" value={relationshipGoal} options={RELATIONSHIP_GOAL_OPTIONS} onPress={() => setActiveModal('relationshipGoal')} icon="heart" accent="#8B5CF6" />
                </View>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Relationship Status</ThemedText>
                  <SelectButton label="Current status" value={relationshipStatus} options={RELATIONSHIP_STATUS_OPTIONS} onPress={() => setActiveModal('relationshipStatus')} icon="info" accent="#8B5CF6" />
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── VIBES TAB ── */}
        {activeTab === 'vibes' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#F59E0B28', '#F59E0B10']} style={styles.cardIconWrap}>
                  <Feather name="zap" size={16} color="#F59E0B" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Personality</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Your inner world</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <InputField label="Personality Type" value={personalityType} onChangeText={setPersonalityType} placeholder="e.g. ENFP, Creative, Empath..." icon="star" accent="#F59E0B" />
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Communication Style</ThemedText>
                  <SelectButton label="How you communicate" value={communicationStyle} options={COMMUNICATION_STYLE_OPTIONS} onPress={() => setActiveModal('communicationStyle')} icon="message-circle" accent="#F59E0B" />
                </View>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Love Language</ThemedText>
                  <SelectButton label="How you express love" value={loveStyle} options={LOVE_STYLE_OPTIONS} onPress={() => setActiveModal('loveStyle')} icon="heart" accent="#F59E0B" />
                </View>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Zodiac Sign</ThemedText>
                  <SelectButton label="Your star sign" value={zodiacSign} options={ZODIAC_OPTIONS} onPress={() => setActiveModal('zodiac')} icon="star" accent="#F59E0B" />
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#10B98128', '#10B98110']} style={styles.cardIconWrap}>
                  <Feather name="coffee" size={16} color="#10B981" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Lifestyle</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Your day-to-day life</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.row2}>
                  <View style={styles.half}>
                    <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Smoking</ThemedText>
                    <SelectButton label="Habits" value={smoking} options={SMOKING_OPTIONS} onPress={() => setActiveModal('smoking')} icon="wind" accent="#10B981" />
                  </View>
                  <View style={styles.half}>
                    <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Drinking</ThemedText>
                    <SelectButton label="Habits" value={drinking} options={DRINKING_OPTIONS} onPress={() => setActiveModal('drinking')} icon="coffee" accent="#10B981" />
                  </View>
                </View>
                <View style={styles.row2}>
                  <View style={styles.half}>
                    <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Workout</ThemedText>
                    <SelectButton label="Frequency" value={workout} options={WORKOUT_OPTIONS} onPress={() => setActiveModal('workout')} icon="activity" accent="#10B981" />
                  </View>
                  <View style={styles.half}>
                    <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Pets</ThemedText>
                    <SelectButton label="Pets?" value={pets} options={PETS_OPTIONS} onPress={() => setActiveModal('pets')} icon="heart" accent="#10B981" />
                  </View>
                </View>
                <View style={[styles.toggleCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F8FA', borderColor: theme.border }]}>
                  <ToggleField label="Has Kids" description="I currently have children" value={hasKids} onValueChange={setHasKids} icon="users" accent="#10B981" />
                  <View style={[styles.toggleDivider, { backgroundColor: theme.border }]} />
                  <ToggleField label="Wants Kids" description="Open to having children" value={wantsKids} onValueChange={setWantsKids} icon="smile" accent="#10B981" />
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── ROOTS TAB ── */}
        {activeTab === 'roots' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#0EA5E928', '#0EA5E910']} style={styles.cardIconWrap}>
                  <Feather name="globe" size={16} color="#0EA5E9" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Background</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Beliefs & education</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Ethnicity</ThemedText>
                  <SelectButton label="Your ethnicity" value={ethnicity} options={ETHNICITY_OPTIONS} onPress={() => setActiveModal('ethnicity')} icon="globe" accent="#0EA5E9" />
                </View>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Religion</ThemedText>
                  <SelectButton label="Your beliefs" value={religion} options={RELIGION_OPTIONS} onPress={() => setActiveModal('religion')} icon="sun" accent="#0EA5E9" />
                </View>
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Education</ThemedText>
                  <SelectButton label="Education level" value={education} options={EDUCATION_OPTIONS} onPress={() => setActiveModal('education')} icon="book" accent="#0EA5E9" />
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#F9731628', '#F9731610']} style={styles.cardIconWrap}>
                  <Feather name="map-pin" size={16} color="#F97316" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Cultural Identity</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Your African roots</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <InputField label="Country of Origin" value={countryOfOrigin} onChangeText={setCountryOfOrigin} placeholder="e.g. Nigeria, Ghana, Kenya..." icon="map-pin" accent="#F97316" />
                <InputField label="Tribe / Ethnic Group" value={tribe} onChangeText={setTribe} placeholder="e.g. Yoruba, Ashanti, Kikuyu..." icon="users" accent="#F97316" />
                <InputField label="African Languages Spoken" value={languagesSpoken} onChangeText={setLanguagesSpoken} placeholder="Comma-separated, e.g. Yoruba, Twi" icon="message-square" accent="#F97316" />
                <View style={styles.fieldWrap}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textSecondary }]}>Diaspora Generation</ThemedText>
                  <SelectButton label="Which generation?" value={diasporaGeneration} options={DIASPORA_GENERATION_OPTIONS} onPress={() => setActiveModal('diasporaGeneration')} icon="git-branch" accent="#F97316" />
                </View>
                <Pressable
                  onPress={() => navigation.navigate('CompatibilityQuiz')}
                  style={({ pressed }) => [styles.quizCta, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <LinearGradient colors={['#F97316', '#FB923C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.quizCtaGradient}>
                    <Ionicons name="heart-circle" size={22} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.quizCtaTitle}>Take Cultural Compatibility Quiz</ThemedText>
                      <ThemedText style={styles.quizCtaSub}>Boost your cultural match score</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ── MORE TAB ── */}
        {activeTab === 'more' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#EF444428', '#EF444410']} style={styles.cardIconWrap}>
                  <Feather name="briefcase" size={16} color="#EF4444" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Work & Location</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Where you are and what you do</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <InputField label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="What you do" icon="briefcase" accent="#EF4444" />
                <InputField label="City / Location" value={livingIn} onChangeText={setLivingIn} placeholder="City, Country" icon="map-pin" accent="#EF4444" />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#9333EA28', '#9333EA10']} style={styles.cardIconWrap}>
                  <Feather name="music" size={16} color="#9333EA" />
                </LinearGradient>
                <View>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Soundtrack</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Your current anthem</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={[styles.songCard, { backgroundColor: isDark ? 'rgba(147,51,234,0.08)' : '#9333EA0A', borderColor: '#9333EA25' }]}>
                  <LinearGradient colors={['#9333EA', '#7C3AED']} style={styles.songIconBox}>
                    <Feather name="music" size={20} color="#FFF" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.songTitleInput, { color: theme.text, borderBottomColor: theme.border }]}
                      value={songTitle}
                      onChangeText={setSongTitle}
                      placeholder="Song title"
                      placeholderTextColor={theme.textSecondary}
                    />
                    <TextInput
                      style={[styles.songArtistInput, { color: theme.textSecondary }]}
                      value={songArtist}
                      onChangeText={setSongArtist}
                      placeholder="Artist name"
                      placeholderTextColor={theme.textSecondary + '90'}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border + '60' }]}>
                <LinearGradient colors={['#EC489928', '#EC489910']} style={styles.cardIconWrap}>
                  <Feather name="mic" size={16} color="#EC4899" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Voice Bio</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: theme.textSecondary }]}>Record a 30-second intro</ThemedText>
                </View>
                {voiceBioUrl ? (
                  <Pressable onPress={handleVoiceBioDelete} hitSlop={8} style={{ padding: 4 }}>
                    <Feather name="trash-2" size={16} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.cardBody}>
                <VoiceBio voiceBioUrl={voiceBioUrl} duration={voiceBioDuration} isOwn={true} hideHeader={true} onRecord={handleVoiceBioRecord} onDelete={handleVoiceBioDelete} />
              </View>
            </View>

            <Pressable
              style={[styles.bottomSave, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color="#FFF" />
                  <ThemedText style={styles.bottomSaveText}>Save Profile</ThemedText>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScreenKeyboardAwareScrollView>

      {/* MODALS */}
      <OptionModal visible={activeModal === 'gender'} onClose={() => setActiveModal(null)} title="Gender" options={GENDER_OPTIONS} selectedValue={gender} onSelect={setGender} />
      <OptionModal visible={activeModal === 'height'} onClose={() => setActiveModal(null)} title="Height" options={HEIGHT_OPTIONS} selectedValue={height} onSelect={setHeight} />
      <OptionModal visible={activeModal === 'lookingFor'} onClose={() => setActiveModal(null)} title="Looking For" subtitle="What are you here for?" options={LOOKING_FOR_OPTIONS} selectedValue={lookingFor} onSelect={setLookingFor} />
      <OptionModal visible={activeModal === 'relationshipGoal'} onClose={() => setActiveModal(null)} title="Relationship Goal" subtitle="Your vision for the future" options={RELATIONSHIP_GOAL_OPTIONS} selectedValue={relationshipGoal} onSelect={setRelationshipGoal} />
      <OptionModal visible={activeModal === 'relationshipStatus'} onClose={() => setActiveModal(null)} title="Relationship Status" options={RELATIONSHIP_STATUS_OPTIONS} selectedValue={relationshipStatus} onSelect={setRelationshipStatus} />
      <OptionModal visible={activeModal === 'smoking'} onClose={() => setActiveModal(null)} title="Smoking" options={SMOKING_OPTIONS} selectedValue={smoking} onSelect={setSmoking} />
      <OptionModal visible={activeModal === 'drinking'} onClose={() => setActiveModal(null)} title="Drinking" options={DRINKING_OPTIONS} selectedValue={drinking} onSelect={setDrinking} />
      <OptionModal visible={activeModal === 'workout'} onClose={() => setActiveModal(null)} title="Workout" options={WORKOUT_OPTIONS} selectedValue={workout} onSelect={setWorkout} />
      <OptionModal visible={activeModal === 'religion'} onClose={() => setActiveModal(null)} title="Religion" options={RELIGION_OPTIONS} selectedValue={religion} onSelect={setReligion} />
      <OptionModal visible={activeModal === 'zodiac'} onClose={() => setActiveModal(null)} title="Zodiac Sign" options={ZODIAC_OPTIONS} selectedValue={zodiacSign} onSelect={setZodiacSign} />
      <OptionModal visible={activeModal === 'education'} onClose={() => setActiveModal(null)} title="Education" options={EDUCATION_OPTIONS} selectedValue={education} onSelect={setEducation} />
      <OptionModal visible={activeModal === 'ethnicity'} onClose={() => setActiveModal(null)} title="Ethnicity" options={ETHNICITY_OPTIONS} selectedValue={ethnicity} onSelect={setEthnicity} />
      <OptionModal visible={activeModal === 'pets'} onClose={() => setActiveModal(null)} title="Pets" options={PETS_OPTIONS} selectedValue={pets} onSelect={setPets} />
      <OptionModal visible={activeModal === 'communicationStyle'} onClose={() => setActiveModal(null)} title="Communication Style" options={COMMUNICATION_STYLE_OPTIONS} selectedValue={communicationStyle} onSelect={setCommunicationStyle} />
      <OptionModal visible={activeModal === 'loveStyle'} onClose={() => setActiveModal(null)} title="Love Language" subtitle="How do you give and receive love?" options={LOVE_STYLE_OPTIONS} selectedValue={loveStyle} onSelect={setLoveStyle} />
      <OptionModal visible={activeModal === 'diasporaGeneration'} onClose={() => setActiveModal(null)} title="Diaspora Generation" subtitle="Which generation of the African diaspora are you?" options={DIASPORA_GENERATION_OPTIONS} selectedValue={diasporaGeneration} onSelect={setDiasporaGeneration} />
      <InterestModal visible={interestsModalVisible} onClose={() => setInterestsModalVisible(false)} />
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // HEADER
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  headerBack: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: 0.1 },
  headerSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, minWidth: 70, justifyContent: 'center' },
  headerSaveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // HERO
  hero: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 14 },
  heroLeft: {},
  heroRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, overflow: 'visible' as const, position: 'relative' },
  heroPhoto: { width: 72, height: 72, borderRadius: 36 },
  heroPhotoEmpty: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const },
  heroRingBadge: { position: 'absolute' as const, bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 2 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  heroSub: { fontSize: 12, marginBottom: 8 },
  heroBarRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  heroBarTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' as const },
  heroBarFill: { height: '100%' as any, borderRadius: 3 },
  heroBarLabel: { fontSize: 12, fontWeight: '700', minWidth: 32 },

  // TAB BAR
  tabBar: { flexDirection: 'row' as const, borderBottomWidth: 1, paddingHorizontal: 4 },
  tabItem: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 5, paddingVertical: 11, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 12, letterSpacing: 0.1 },

  // SCROLL CONTENT
  scrollContent: { paddingHorizontal: 14, paddingTop: 16, gap: 14 },

  // CARD
  card: { borderRadius: 18, overflow: 'hidden' as const, borderWidth: 1 },
  cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, gap: 12 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },
  cardBody: { padding: 14, gap: 12 },

  // FIELDS
  fieldWrap: { gap: 6 },
  miniLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  row2: { flexDirection: 'row' as const, gap: 10 },
  half: { flex: 1, gap: 6 },

  // InputField sub-component uses these
  fieldContainer: {},
  fieldLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 7, gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  fieldFilledDot: { width: 5, height: 5, borderRadius: 3 },
  inputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, minHeight: 50, gap: 10 },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' as const },

  // SelectButton sub-component uses these
  selectButton: { height: 50, borderRadius: 12, borderWidth: 1, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, gap: 10 },
  selectIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  selectButtonText: { fontSize: 14, flex: 1 },

  // INTERESTS
  triggerRow: { height: 50, borderRadius: 12, borderWidth: 1, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, gap: 10 },
  triggerIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  triggerText: { flex: 1, fontSize: 14 },
  chipsWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 7 },
  chip: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 5 },
  chipText: { fontSize: 12, fontWeight: '500' },

  // TOGGLE CARD
  toggleCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' as const },
  toggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: 'transparent' },
  toggleLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, flex: 1, gap: 12 },
  toggleIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  toggleTextGroup: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDescription: { fontSize: 12, marginTop: 1 },
  toggleDivider: { height: 1, marginHorizontal: 14 },

  // SONG CARD
  songCard: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
  songIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  songTitleInput: { fontSize: 15, fontWeight: '600', paddingVertical: 6, borderBottomWidth: 1, marginBottom: 4 },
  songArtistInput: { fontSize: 13, paddingVertical: 4 },

  // QUIZ CTA
  quizCta: { borderRadius: 14, overflow: 'hidden' as const, marginTop: 4 },
  quizCtaGradient: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  quizCtaTitle: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  quizCtaSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  // BOTTOM SAVE
  bottomSave: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10, height: 54, borderRadius: 27, marginTop: 4 },
  bottomSaveText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // MODALS
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' as const },
  modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82%' as any },
  modalDragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' as const, marginTop: 10, marginBottom: 2 },
  modalHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  modalFooter: { padding: 16, borderTopWidth: 1 },
  doneButton: { height: 50, borderRadius: 25, alignItems: 'center' as const, justifyContent: 'center' as const },
  doneButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  interestOptionItem: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, margin: 5, padding: 12, borderRadius: 12, borderWidth: 1.5, gap: 8, position: 'relative' as const },
  interestIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  interestOptionLabel: { flex: 1, fontSize: 13 },
  interestCheckBadge: { position: 'absolute' as const, top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },

  optionItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
  optionLabel: { fontSize: 16 },
  optionCheckCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
});
`;

fs.writeFileSync('frontend/screens/EditProfileScreen.tsx', before + newJSX);
console.log('Done. Total lines:', (before + newJSX).split('\n').length);
console.log('Main return pos was:', mainReturnPos);
