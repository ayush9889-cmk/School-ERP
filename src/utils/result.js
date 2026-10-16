function getGrade(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

// exam: Exam doc, marks: us student ke Mark docs
function buildResult(exam, marks) {
  const subjects = exam.subjects.map((s) => {
    const m = marks.find((x) => x.subject === s.name);
    return {
      subject: s.name,
      maxMarks: s.maxMarks,
      obtained: m ? m.obtained : null,
      absent: m ? m.absent : false,
      entered: !!m,
    };
  });

  const entered = subjects.filter((s) => s.entered);
  const totalMax = entered.reduce((sum, s) => sum + s.maxMarks, 0);
  const totalObtained = entered.reduce(
    (sum, s) => sum + (s.absent ? 0 : s.obtained || 0),
    0,
  );
  const percentage = totalMax
    ? Math.round((totalObtained / totalMax) * 10000) / 100
    : 0;
  const pending = subjects.length - entered.length;

  const failedSubjects = entered.filter(
    (s) => s.absent || (s.obtained / s.maxMarks) * 100 < 33,
  );

  return {
    exam: { id: exam._id, name: exam.name, className: exam.className },
    subjects,
    totalObtained,
    totalMax,
    percentage,
    grade: totalMax ? getGrade(percentage) : null,
    status:
      pending > 0 ? "Incomplete" : failedSubjects.length ? "Fail" : "Pass",
    complete: pending === 0,
  };
}

module.exports = { buildResult, getGrade };
