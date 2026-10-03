"""Match DOCX answers to official PDF tickets; retain both source wordings."""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'


def text(element):
    return ''.join(node.text or '' for node in element.findall('.//w:t', NS)).strip()


def normalize(value):
    return re.sub(r'\s+', ' ', value).strip()


def comparable(value):
    return normalize(value).translate(str.maketrans({'’': "'", '“': '«', '”': '»', '–': '-'}))


def extract(docx_path, pdf_path):
    pdf = PdfReader(pdf_path)
    pdf_text = '\n'.join(page.extract_text() for page in pdf.pages)
    parts = re.split(r'Білет\s*№\s*(\d+)', pdf_text)
    official = []
    for i in range(1, len(parts), 2):
        questions = re.findall(r'(?:^|\n)\s*([12])\.?\s+(.+?)(?=(?:\n\s*[12]\.\s)|\Z)', parts[i+1], re.S)
        official.append({'number': int(parts[i]), 'items': [
            {'number': int(number), 'question': normalize(question)} for number, question in questions
        ]})
    if [t['number'] for t in official] != list(range(1, 23)) or any([q['number'] for q in t['items']] != [1, 2] for t in official):
        raise ValueError('Expected 22 official PDF tickets with two questions each')

    with ZipFile(docx_path) as archive:
        body = ET.fromstring(archive.read('word/document.xml')).find('w:body', NS)
    authored = []
    supplements = []
    intro = []
    ticket = None
    item = None
    section = None
    for element in body:
        if element.tag == W+'tbl':
            if section is None:
                raise ValueError('Unexpected table before supplement section')
            section['rows'] = [[normalize(' '.join(text(p) for p in cell.findall('w:p', NS)))
                                for cell in row.findall('w:tc', NS)] for row in element.findall('w:tr', NS)]
            continue
        if element.tag != W+'p':
            continue
        value = text(element)
        if not value:
            continue
        style = element.find('w:pPr/w:pStyle', NS)
        style = style.get(W+'val') if style is not None else ''
        match = re.fullmatch(r'Билет №(\d+)', value)
        if match:
            ticket = {'number': int(match[1]), 'items': []}
            authored.append(ticket)
            item = None
            continue
        if style == 'Heading1':
            section = {'title': value, 'paragraphs': []}
            supplements.append(section)
            ticket = None
            continue
        if section is not None:
            section['paragraphs'].append(value)
            continue
        if ticket is None:
            if style != 'Title':
                intro.append(value)
            continue
        match = re.match(r'^([12])\.\s+(.+)$', value)
        if match:
            item = {'number': int(match[1]), 'question': match[2], 'takeaway': '', 'answer': '', 'support': ''}
            ticket['items'].append(item)
            continue
        for prefix, field in [('Что запомнить: ', 'takeaway'), ('Коротко важное: ', 'answer'), ('Опора: ', 'support')]:
            if value.startswith(prefix) and item is not None:
                item[field] = value[len(prefix):]
                break
        else:
            raise ValueError(f'Unexpected DOCX paragraph: {value}')
    if [t['number'] for t in authored] != list(range(1, 23)) or any([q['number'] for q in t['items']] != [1, 2] for t in authored):
        raise ValueError('Expected 22 DOCX tickets with two answers each')

    keywords = [
        'Церковь и право|Юридическое обеспечение прихода', 'Наука канонического права|Приход',
        'История канонического права|Избрание клириков|Миряне', 'Источники права|Поставление клириков',
        'Вселенские Соборы|Обязанности клириков', 'Источники права|Вселенские Соборы|Поставление клириков|Синодальный период',
        'Крещение|Приход|Синодальный период', 'Иерархия|Церковнослужители|Приход|Синодальный период',
        'Избрание клириков|Приход|Собор 1917–1918', 'Хиротония|Приход|Статут УПЦ',
        'Препятствия к священству|Приходское управление', 'Кандидат священства|Настоятель',
        'Состав Церкви|Состав прихода', 'Писание|Источники права|Приходское собрание', 'Патриарх|Приходской совет',
        'Вступление в Церковь|Ревизионная комиссия', 'Апостольские правила|Иерархия|Поставление клириков|Хиротония',
        'Кандидат священства|Препятствия к священству|Монашество', 'Обязанности клириков|Церковная территория',
        'Церковнослужители|Автокефалия|Автономия', 'Церковная власть|Церковный суд', 'Священный Синод|Церковные наказания'
    ]
    groups = [
        {'title': 'Основы и источники', 'tags': ['Церковь и право','Наука канонического права','История канонического права','Источники права','Писание','Апостольские правила']},
        {'title': 'Иерархия и служение', 'tags': ['Иерархия','Состав Церкви','Избрание клириков','Миряне','Поставление клириков','Хиротония','Кандидат священства','Препятствия к священству','Обязанности клириков','Церковнослужители','Состав прихода']},
        {'title': 'Приход и его управление', 'tags': ['Юридическое обеспечение прихода','Приход','Синодальный период','Собор 1917–1918','Статут УПЦ','Приходское управление','Настоятель','Приходское собрание','Приходской совет','Ревизионная комиссия']},
        {'title': 'Церковное устройство', 'tags': ['Вселенские Соборы','Патриарх','Священный Синод','Церковная власть','Церковная территория','Автокефалия','Автономия']},
        {'title': 'Таинства и дисциплина', 'tags': ['Крещение','Вступление в Церковь','Монашество','Церковный суд','Церковные наказания']}
    ]
    differences = []
    tickets = []
    for pdf_ticket, doc_ticket, tags in zip(official, authored, keywords):
        items = []
        for pdf_item, doc_item in zip(pdf_ticket['items'], doc_ticket['items']):
            if not all(doc_item[key] for key in ['takeaway','answer','support']):
                raise ValueError(f'Incomplete answer: ticket {doc_ticket["number"]}')
            if comparable(pdf_item['question']) != comparable(doc_item['question']):
                differences.append({'ticket': pdf_ticket['number'], 'item': pdf_item['number'],
                                    'pdf': pdf_item['question'], 'docx': doc_item['question']})
            items.append({**doc_item, 'question': pdf_item['question'], 'docxQuestion': doc_item['question']})
        tickets.append({'id': f'canonical-law-ticket-{pdf_ticket["number"]}', 'number': pdf_ticket['number'],
                        'course': 1, 'title': f'Билет №{pdf_ticket["number"]}', 'tags': tags.split('|'), 'items': items})
    return {'title': 'Каноническое право и юридическое обеспечение прихода',
            'sourceDocument': Path(docx_path).name, 'officialDocument': Path(pdf_path).name,
            'intro': intro, 'filterGroups': groups, 'tickets': tickets, 'supplements': supplements,
            'verification': {'ticketCount': 22, 'questionCount': 44, 'pdfPageCount': len(pdf.pages),
                             'wordingDifferences': differences}}, official


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('docx')
    parser.add_argument('pdf')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    data, official = extract(args.docx, args.pdf)
    content = ROOT/'content/canonical-law-tickets.json'
    pdf_content = ROOT/'content/canonical-law-official-tickets.json'
    if args.verify_only:
        assert json.loads(content.read_text(encoding='utf-8')) == data, 'DOCX data mismatch'
        assert json.loads(pdf_content.read_text(encoding='utf-8')) == official, 'PDF data mismatch'
        print('Verified 22 tickets / 44 questions against PDF; all DOCX answers and supplements match.')
    else:
        content.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        pdf_content.write_text(json.dumps(official, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(data['verification'], ensure_ascii=False, indent=2))
