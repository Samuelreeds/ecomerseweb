import React, { createContext, useContext, useState, useEffect } from 'react';

const LocalizationContext = createContext();

export function LocalizationProvider({ children }) {
  // Initialize from localStorage or default to EN / USD
  const [language, setLanguage] = useState(() => localStorage.getItem('noir_lang') || 'EN');
  const [currency, setCurrency] = useState(() => localStorage.getItem('noir_currency') || 'USD');
  
  // Standard exchange rate
  const exchangeRate = 4100;

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('noir_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('noir_currency', currency);
  }, [currency]);

  // Helper function to format prices instantly anywhere in the app
  const formatPrice = (usdPrice) => {
    if (!usdPrice && usdPrice !== 0) return '';
    if (currency === 'KHR') {
      return `${(usdPrice * exchangeRate).toLocaleString()} ៛`;
    }
    return `$${usdPrice.toFixed(2)}`;
  };

  // Helper function for quick text translation: t('English text', 'Khmer text')
  const t = (enString, khString) => {
    return language === 'KH' && khString ? khString : enString;
  };

  return (
    <LocalizationContext.Provider value={{ 
      language, setLanguage, 
      currency, setCurrency, 
      exchangeRate, formatPrice, t 
    }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export const useLocalization = () => useContext(LocalizationContext);