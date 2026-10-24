import { createContext, useContext, useState } from 'react';

// Guarda se o menu lateral está aberto e oferece abrir/fechar para qualquer tela.
const MenuContext = createContext(null);

export function MenuProvider({ children }) {
  const [aberto, setAberto] = useState(false);

  return (
    <MenuContext.Provider
      value={{ aberto, abrir: () => setAberto(true), fechar: () => setAberto(false) }}
    >
      {children}
    </MenuContext.Provider>
  );
}

// Atalho: const { abrir } = useMenu();
export const useMenu = () => useContext(MenuContext);