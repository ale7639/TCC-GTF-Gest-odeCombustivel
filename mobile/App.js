import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import Caminhoes from './src/screens/Caminhoes';
import Motoristas from './src/screens/Motoristas';

const Tab = createBottomTabNavigator();

// Ícone de cada aba, pelo nome da aba.
const icones = {
  Painel: 'view-dashboard-outline',
  Caminhões: 'truck-outline',
  Motoristas: 'account-group-outline',
};

// Decide o que mostrar: carregando, login (sem sessão) ou as abas (com sessão).
function Rotas() {
  const { token, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token) return <Login />;

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={icones[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Painel" component={Dashboard} />
        <Tab.Screen name="Caminhões" component={Caminhoes} />
        <Tab.Screen name="Motoristas" component={Motoristas} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});