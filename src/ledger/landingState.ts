/**
 * Whether the next authenticated screen is a landing: a fresh page load or the first screen after
 * login. Landings on the classic root go to the ledger shell; any later visit to the root (the
 * classic sidebar's Dashboard link, the "Classic dashboard" link) stays on the original.
 */

let landing = true;

export const isLanding = () => landing;

export const setLanding = (value: boolean) => {
  landing = value;
};
