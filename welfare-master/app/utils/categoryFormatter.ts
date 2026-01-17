export const formatCategoryName = (name: string | null): string => {
    if (!name) return '未分類';

    // 1. Remove prefixes like "PSW専5", "Book_001", cleaning spaces
    let formatted = name
        .replace(/^PSW専\d+[ 　]*/, '')
        .replace(/^Book_\d+/, '')
        .trim();

    // 2. Map extremely long names to shorter, meaningful versions
    const MAPPING: Record<string, string> = {
        'ソーシャルワーク実習指導ソーシャルワーク実習': 'SW実習指導・実習',
        '精神保健福祉援助演習（基礎・専門）': '精神保健援助演習',
        '精神保健福祉の理論と相談援助の展開': '精神保健福祉の理論',
        '精神障害者の生活支援システム': '生活支援システム',
        '現代の精神保健の課題と支援': '現代の精神保健',
        '人体の構造と機能及び疾病': '人体と疾病',
        '心理学理論と心理的支援': '心理学理論',
        '社会理論と社会システム': '社会理論',
        '地域福祉の理論と方法': '地域福祉',
        '福祉行財政と福祉計画': '福祉行財政・計画',
        '社会保障': '社会保障',
        '障害者に対する支援と障害者自立支援制度': '障害者支援・自立支援',
        '低所得者に対する支援と生活保護制度': '低所得者支援・生保',
        '保健医療サービス': '保健医療サービス',
        '権利擁護と成年後見制度': '権利擁護・成年後見',
    };

    if (MAPPING[formatted]) {
        return MAPPING[formatted];
    }

    // 3. General truncation if still too long (fallback)
    // if (formatted.length > 12) {
    //    return formatted.substring(0, 11) + '…';
    // }

    return formatted;
};
