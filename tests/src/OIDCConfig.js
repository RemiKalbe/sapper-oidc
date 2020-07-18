export const authPath = "/auth"; // This route initiate the OIDC flow.
export const refreshPath = "/refresh"; // This is the route that will be called when tokens need to be refreshed
export const protectedPaths = [
  // This array stores all routes where the user MUST be logged in, if he is not he will be redirected to the identity provider.
  {
    path: "/private-info",
    recursive: true /* This means that all route starting with /private-info requires the user to be logged in*/,
  },
  {
    path: "/privateOnlyHere",
    recursive: false /* This means that only /privateOnlyHere requires the user to be logged in, /privateOnlyHere/1234569 doesn't require the user to be logged in*/,
  },
];
