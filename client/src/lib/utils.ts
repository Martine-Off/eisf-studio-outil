/** Formate une date ISO en heure Paris (Europe/Paris), format fr-FR.
 *  Normalise la chaîne en UTC si elle ne porte pas de suffixe timezone. */
export function formatDateParis(dateStr: string): string {
    const normalized = dateStr.endsWith('Z') || dateStr.includes('+')
        ? dateStr
        : dateStr + 'Z';
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(normalized));
}
