/** Formate une date ISO (avec ou sans 'Z') en heure Paris, format fr-FR. */
export function formatDateParis(dateStr: string): string {
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
