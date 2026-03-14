// redux store configuration
import { configureStore } from "@reduxjs/toolkit";
import themeReducer from "./slices/themeSlice";
import graphReducer from "./slices/graphSlice";
import { apiSlice } from "./slices/apiSlice";

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    graph: graphReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: import.meta.env.DEV,
});

export default store;