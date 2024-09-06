export function removeMatterCode(caseName) {
    if (!caseName)
        return '';
    const regex = /(\d{4})([A-Z]{3})(\d{2})(\s*)(.*)/;
    const match = caseName.match(regex);
    if (!match || match.length < 6)
        return caseName;
    const numberPart = match[3];
    if (numberPart === '01')
        return match[5];
    return match[5].trim() + ' ' + numberPart;
}
