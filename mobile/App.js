import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import Caminhoes from './src/screens/Caminhoes';
import Motoristas from './src/screens/Motoristas';
import Abastecimentos from './src/screens/Abastecimentos';
import Tanques from './src/screens/Tanques';

const Tab = createBottomTabNavigator();

// Ícone de cada aba, pelo nome da aba.
const icones = {
  Painel: 'view-dashboard-outline',
  Frota: 'truck-outline',
  Motoristas: 'account-group-outline',
  Abastecimentos: 'gas-station-outline',
  Tanques: 'water-outline',
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
        <Tab.Screen name="Frota" component={Caminhoes} />
        <Tab.Screen name="Motoristas" component={Motoristas} />
        <Tab.Screen name="Abastecimentos" component={Abastecimentos} />
        <Tab.Screen name="Tanques" component={Tanques} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // No navegador, o app fica numa coluna centralizada (como num celular), em vez de esticar na tela toda.
  return (
    <View style={styles.pagina}>
      <View style={styles.app}>
        <AuthProvider>
          <Rotas />
        </AuthProvider>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#d1d5db' },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
  },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});