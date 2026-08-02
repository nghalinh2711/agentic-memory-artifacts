import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import ThemeRegistry from "@/components/ThemeRegistry";

interface AllTheProvidersProps {
  children: ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return <ThemeRegistry>{children}</ThemeRegistry>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

export * from "@testing-library/react";
export { customRender as render };
