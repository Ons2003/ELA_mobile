import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const steps = [
  'Port the core screens into React Native components.',
  'Replace web-only UI (Radix, Tailwind, DOM APIs) with RN equivalents.',
  'Reconnect Supabase auth, storage, and edge functions with RN-safe APIs.',
];

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.title}>ELA Expo Migration</Text>
        <Text style={styles.subtitle}>Mobile foundation is ready. Next steps:</Text>
        <View style={styles.list}>
          {steps.map((item, index) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bullet}>{index + 1}.</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3ef',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#ede6de',
    shadowColor: '#0b0b0b',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#121212',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4a4a4a',
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c0392b',
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: '#2b2b2b',
    lineHeight: 20,
  },
});

export default App;
