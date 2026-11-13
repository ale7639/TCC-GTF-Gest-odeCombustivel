import { createContext, useContext, useEffect, useState } from 'react';
import { armazenamento } from '../storage';
import { api, definirAoExpirar } from '../api';

// AUTH — sessão (token + usuário) compartilhada entre as telas.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true); // true enquanto lê a sessão guardada

  // Apaga a sessão só no aparelho (não chama a API).
  const limparSessao = async () => {
    await armazenamento.apagar('token');
    await armazenamento.apagar('usuario');
    setToken(null);
    setUsuario(null);
  };

  useEffect(() => {
    // Ao abrir o app, recupera a sessão guardada (se existir).
    (async () => {
      const tokenGuardado = await armazenamento.ler('token');
      const usuarioGuardado = await armazenamento.ler('usuario');
      if (tokenGuardado) {
        setToken(tokenGuardado);
        setUsuario(usuarioGuardado ? JSON.parse(usuarioGuardado) : null);
      }
      setCarregando(false);
    })();

    // Se o servidor recusar o token, volta para a tela de login.
    definirAoExpirar(limparSessao);
  }, []);

  // AUTH ENTRAR — login = CPF (motorista) ou e-mail (admin).
  const entrar = async (login, senha) => {
    const dados = await api('/login', {
      metodo: 'POST',
      corpo: { login, password: senha },
    });
    await armazenamento.gravar('token', dados.token);
    await armazenamento.gravar('usuario', JSON.stringify(dados.usuario));
    setToken(dados.token);
    setUsuario(dados.usuario);
  };

  // AUTH SAIR — avisa a API e limpa a sessão no aparelho.
  const sair = async () => {
    try {
      await api('/logout', { metodo: 'POST' });
    } catch (e) {
      // Mesmo sem conexão, o usuário precisa conseguir sair.
    }
    await limparSessao();
  };

  const atualizarUsuario = async (parcial) => {
    const novo = { ...usuario, ...parcial };
    await armazenamento.gravar('usuario', JSON.stringify(novo));
    setUsuario(novo);
  };

  return (
    <AuthContext.Provider value={{ token, usuario, carregando, entrar, sair, atualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

// Atalho: const { sair } = useAuth();
export const useAuth = () => useContext(AuthContext);
