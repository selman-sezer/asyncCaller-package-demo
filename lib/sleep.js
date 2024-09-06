export async function sleep(ms) {
  if (ms <= 0) {
    await Promise.resolve();
    return;
  }
  return await new Promise((resolve) => setTimeout(resolve, ms));
}
