import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  BorderStyle,
} from 'docx';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// No AI here, this is a pure template auto filled from Meetings and
// Attendance. Agenda / Discussion Points / Decisions Made / Action Items
// are left blank for whoever is taking minutes to fill in inside Word.

function meetingLabel(meeting) {
  return meeting['Scope'] === 'Council' ? 'Council Meet' : `Portfolio Meet — ${meeting['Portfolio']}`;
}

function cell(text, { bold = false, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

function blankSection(title) {
  return [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
  ];
}

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session) return new Response('Not signed in.', { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return new Response('Manager or Admin access required.', { status: 403 });
  }

  const [{ records: meetings }, { records: attendance }] = await Promise.all([
    readSheet(TABS.meetings),
    readSheet(TABS.attendance),
  ]);

  const meeting = meetings.find((m) => m['Meeting ID'] === params.id);
  if (!meeting) return new Response('Meeting not found.', { status: 404 });

  const people = attendance
    .filter((a) => a['Meeting ID'] === params.id)
    .sort((a, b) => (a['Full Name'] || '').localeCompare(b['Full Name'] || ''));

  const present = people.filter((p) => p['Status'] === 'Present').length;
  const absent = people.filter((p) => p['Status'] === 'Absent').length;
  const leave = people.filter((p) => p['Status'] === 'Leave').length;

  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

  const headerChildren = [];
  if (logoBuffer) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: logoBuffer, transformation: { width: 64, height: 64 } })],
      })
    );
  }
  headerChildren.push(
    new Paragraph({
      text: 'NXC — Minutes of Meeting',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
    rows: [
      new TableRow({ children: [cell('Meeting', { bold: true, width: 30 }), cell(meetingLabel(meeting))] }),
      new TableRow({ children: [cell('Date', { bold: true }), cell(meeting['Date'] || '')] }),
      new TableRow({ children: [cell('Meeting ID', { bold: true }), cell(meeting['Meeting ID'] || '')] }),
      new TableRow({
        children: [
          cell('Attendance', { bold: true }),
          cell(`${present} Present, ${absent} Absent, ${leave} Leave, of ${people.length} total`),
        ],
      }),
    ],
  });

  const attendanceRows = [
    new TableRow({
      children: [cell('Name', { bold: true, width: 70 }), cell('Status', { bold: true, width: 30 })],
    }),
    ...people.map(
      (p) =>
        new TableRow({
          children: [cell(p['Full Name'] || ''), cell(p['Status'] || '')],
        })
    ),
  ];
  const attendanceTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
    rows: attendanceRows,
  });

  const doc = new Document({
    sections: [
      {
        children: [
          ...headerChildren,
          infoTable,
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Attendance', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
          attendanceTable,
          ...blankSection('Agenda'),
          ...blankSection('Discussion Points'),
          ...blankSection('Decisions Made'),
          ...blankSection('Action Items'),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `minutes-${meeting['Date']}-${meetingLabel(meeting)}.docx`.replace(/[^a-z0-9.\-_ ]/gi, '_');

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
