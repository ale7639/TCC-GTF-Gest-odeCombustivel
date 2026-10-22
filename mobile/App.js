import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';

const Tab = createBottomTabNavigator();

// Ícone de cada aba, pelo nome da aba.
const icones = {
  Painel: 'view-dashboard-outline',
  Caminhões: 'truck-outline',
  Motoristas: 'account-group-outline',
};

// Tela provisória: será trocada pelas telas reais nos próximos passos.
function EmBreve({ titulo }) {
  return (
    <View style={styles.emBreve}>
      <Text style={styles.emBreveTitulo}>{titulo}</Text>
      <Text style={styles.emBreveTexto}>Esta tela será criada nos próximos passos.</Text>
    </View>
  );
}
const TelaCaminhoes = () => <EmBreve titulo="Caminhões" />;
const TelaMotoristas = () => <EmBreve titulo="Motoristas" />;

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
        <Tab.Screen name="Caminhões" component={TelaCaminhoes} />
        <Tab.Screen name="Motoristas" component={TelaMotoristas} />
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
  emBreve: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
    paddingTop: 56,
  },
  emBreveTitulo: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  emBreveTexto: { fontSize: 14, color: '#6b7280', marginTop: 8 },
});