import { useNavigate, useLocation } from "react-router-dom";
import { STEPS } from "../constants/steps";

/**
 * Returns helpers to navigate between wizard steps.
 */
export function useStepNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const currentIndex = STEPS.findIndex((s) => s.path === pathname);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STEPS.length - 1;

  const goNext = () => {
    if (!isLast) navigate(STEPS[currentIndex + 1].path);
  };

  const goBack = () => {
    if (!isFirst) navigate(STEPS[currentIndex - 1].path);
  };

  return { goNext, goBack, isFirst, isLast, currentIndex };
}
