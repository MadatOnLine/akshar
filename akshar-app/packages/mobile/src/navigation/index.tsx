/**
 * Navigation — auth gate, risk overlay, tabs, and stack screens.
 * Redesigned with true-black iOS aesthetic and breathing logo animation.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../providers/AuthProvider';
import { EnrollmentScreen } from '../screens/EnrollmentScreen';
import { GroupListScreen } from '../screens/GroupListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ModeratorScreen } from '../screens/ModeratorScreen';
import { AccountStudioScreen } from '../screens/AccountStudioScreen';
import { RiskVerificationScreen } from '../screens/RiskVerificationScreen';
import type { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types';

const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TRUE_BLACK = '#000000';
const ACTIVE_TINT = '#0A84FF';
const INACTIVE_TINT = '#636366';
const HEADER_TEXT = '#FFFFFF';
const SUBTITLE_COLOR = '#8E8E93';

function LoadingScreen() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing pulse: 1.0 → 1.05 → 1.0 (repeating)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Fade in on mount
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <View testID="loading-screen" style={styles.loadingContainer}>
      <Animated.Image
        testID="loading-logo"
        source={require('../../assets/logo.jpg')}
        style={[
          styles.loadingLogo,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
            width: 140,
            height: 140,
            resizeMode: 'contain',
          },
        ]}
      />
      <Animated.Text
        testID="loading-text"
        style={[styles.loadingText, { opacity: opacityAnim }]}
      >
        Establishing secure connection…
      </Animated.Text>
    </View>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{emoji}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarStyle: {
          backgroundColor: TRUE_BLACK,
          borderTopColor: '#1C1C1E',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Groups"
        component={GroupListScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} />,
          tabBarTestID: 'tab-chat',
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color }) => <TabIcon emoji="📡" color={color} />,
          tabBarTestID: 'tab-feed',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
          tabBarTestID: 'tab-profile',
        }}
      />
      <Tab.Screen
        name="Admin"
        component={ModeratorScreen}
        options={{
          tabBarLabel: 'Admin',
          tabBarIcon: ({ color }) => <TabIcon emoji="🛡️" color={color} />,
          tabBarTestID: 'tab-admin',
        }}
      />
    </Tab.Navigator>
  );
}

const darkHeaderOptions = {
  headerStyle: { backgroundColor: TRUE_BLACK },
  headerTintColor: HEADER_TEXT,
  headerTitleStyle: { color: HEADER_TEXT },
};

function MainNavigator() {
  const { requiresRiskCheck, riskReason, checkRisk, clearRisk } = useAuth();

  return (
    <>
      <MainStack.Navigator
        screenOptions={{
          headerShown: false,
          ...darkHeaderOptions,
        }}
      >
        <MainStack.Screen name="Home" component={MainTabs} />
        <MainStack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ headerShown: false, title: 'Chat' }}
        />
        <MainStack.Screen name="AccountStudio" component={AccountStudioScreen} />
      </MainStack.Navigator>
      <RiskVerificationScreen
        visible={requiresRiskCheck}
        reason={riskReason}
        onVerified={async () => {
          clearRisk();
          await checkRisk();
        }}
      />
    </>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        ...darkHeaderOptions,
      }}
    >
      <AuthStack.Screen name="FaceLogin" component={EnrollmentScreen} />
    </AuthStack.Navigator>
  );
}

export function AppNavigation() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          background: TRUE_BLACK,
          card: TRUE_BLACK,
          text: '#FFFFFF',
          border: '#1C1C1E',
          primary: ACTIVE_TINT,
          notification: ACTIVE_TINT,
        },
      }}
    >
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 72,
    color: ACTIVE_TINT,
    marginBottom: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    letterSpacing: 0.5,
    fontWeight: '500',
    marginTop: 24,
  },
});
