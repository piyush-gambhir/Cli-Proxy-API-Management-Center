import { useEffect } from 'react';
import { Outlet, RouterProvider, createHashRouter } from 'react-router-dom';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { LoginRevealVeil } from '@/components/common/LoginRevealVeil';
import { ClassicRedirect } from '@/ledger/classicRedirect';
import { ClassicEntry, LoginEntry } from '@/ledger/LandingRoutes';
import { LedgerLayout } from '@/ledger/LedgerLayout';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { useLanguageStore, useThemeStore } from '@/stores';

function RootShell() {
  return (
    <>
      <NotificationContainer />
      <ConfirmationModal />
      <Outlet />
      <LoginRevealVeil />
    </>
  );
}



const devPreviewRoutes = import.meta.env.DEV
  ? [
      {
        path: '/__preview/quota-tiers',
        HydrateFallback: () => null,
        lazy: async () => {
          const { QuotaTierPreview } = await import('@/features/quota/preview/QuotaTierPreview');
          return { Component: QuotaTierPreview };
        },
      },
    ]
  : [];

const router = createHashRouter([
  {
    element: <RootShell />,
    children: [
      ...devPreviewRoutes,


      { path: '/login', element: <LoginEntry /> },
      {
        path: '/ledger/*',
        element: (
          <ProtectedRoute>
            <LedgerLayout />
          </ProtectedRoute>
        ),
      },
      {
        path: '/*',
        element: (
          <ProtectedRoute>
            {                                                                                    }
            <ClassicRedirect>
              <ClassicEntry />
            </ClassicRedirect>
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

function App() {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  useEffect(() => {
    const cleanupTheme = initializeTheme();
    return cleanupTheme;
  }, [initializeTheme]);

  useEffect(() => {
    setLanguage(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <RouterProvider router={router} />;
}

export default App;
