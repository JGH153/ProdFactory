export const formatHoursMinutes = (seconds: number): string => {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (m > 0) {
		return `${h}h ${m}m`;
	}
	return `${h}h`;
};
