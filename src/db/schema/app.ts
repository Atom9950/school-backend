import {
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    varchar,
    index,
    primaryKey
} from "drizzle-orm/pg-core";
import {relations} from "drizzle-orm";
import {user} from "./auth.js";

export const classStatusEnum = pgEnum('class_status', ['active', 'inactive', 'archived']);

const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export const departments = pgTable('departments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', {length: 50}).notNull().unique(),
    name: varchar('name', {length: 255}).notNull(),
    description: varchar('description', {length: 255}),
    bannerUrl: text('banner_url'),
    bannerCldPubId: text('banner_cld_pub_id'),
    headTeacherId: text('head_teacher_id').references(() => user.id, { onDelete: 'set null' }),
    level: integer('level').notNull().default(1),
    parentDepartmentId: integer('parent_department_id').references(() => departments.id, { onDelete: 'set null' }),
    ...timestamps
});

export const subjects = pgTable('subjects', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
    name: varchar('name', {length: 255}).notNull(),
    code: varchar('code', {length: 50}).notNull().unique(),
    description: varchar('description', {length: 255}),
    ...timestamps
});

export const classes = pgTable('classes', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id').references(() => user.id, { onDelete: 'set null' }),
    inviteCode: text('invite_code').notNull().unique(),
    name: varchar('name', {length: 255}).notNull(),
    bannerCldPubId: text('banner_cld_pub_id'),
    bannerUrl: text('banner_url'),
    description: text('description'),
    capacity: integer('capacity').default(50).notNull(),
    status: classStatusEnum('status').default('active').notNull(),
    schedules: jsonb('schedules').$type<any[]>().default([]).notNull(),
    ...timestamps
}, (table) => [
    index('classes_department_id_idx').on(table.departmentId),
    index('classes_subject_id_idx').on(table.subjectId),
    index('classes_teacher_id_idx').on(table.teacherId),
]);

export const enrollments = pgTable('enrollments', {
    studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.studentId, table.classId] }),
    unique('enrollments_student_id_class_id_unique').on(table.studentId, table.classId),
    index('enrollments_student_id_idx').on(table.studentId),
    index('enrollments_class_id_idx').on(table.classId),
]);

export const teacherDepartments = pgTable('teacher_departments', {
    teacherId: text('teacher_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.teacherId, table.departmentId] }),
    unique('teacher_departments_teacher_id_department_id_unique').on(table.teacherId, table.departmentId),
    index('teacher_departments_teacher_id_idx').on(table.teacherId),
    index('teacher_departments_department_id_idx').on(table.departmentId),
]);

export const teacherClasses = pgTable('teacher_classes', {
    teacherId: text('teacher_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.teacherId, table.classId] }),
    unique('teacher_classes_teacher_id_class_id_unique').on(table.teacherId, table.classId),
    index('teacher_classes_teacher_id_idx').on(table.teacherId),
    index('teacher_classes_class_id_idx').on(table.classId),
]);

export const students = pgTable('students', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', {length: 255}).notNull(),
    email: varchar('email', {length: 255}).unique(),
    age: integer('age').notNull(),
    gender: varchar('gender', {length: 50}).notNull(),
    fathersName: varchar('fathers_name', {length: 255}),
    mothersName: varchar('mothers_name', {length: 255}),
    address: text('address'),
    phoneNumber: varchar('phone_number', {length: 20}),
    whatsappNumber: varchar('whatsapp_number', {length: 20}),
    admissionDate: timestamp('admission_date').notNull(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
    rollNumber: varchar('roll_number', {length: 50}),
    image: text('image'),
    imageCldPubId: text('image_cld_pub_id'),
    ...timestamps
}, (table) => [
    index('students_department_id_idx').on(table.departmentId),
    index('students_email_idx').on(table.email),
]);

export const departmentRelations = relations(departments, ({ many, one }) => ({
    subjects: many(subjects),
    headTeacher: one(user, {
        fields: [departments.headTeacherId],
        references: [user.id],
    }),
    parentDepartment: one(departments, {
        fields: [departments.parentDepartmentId],
        references: [departments.id],
        relationName: 'parent'
    }),
    sections: many(departments, {
        relationName: 'parent'
    })
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
    department: one(departments, {
        fields: [subjects.departmentId],
        references: [departments.id],
    }),
    classes: many(classes)
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
    subject: one(subjects, {
        fields: [classes.subjectId],
        references: [subjects.id],
    }),
    teacher: one(user, {
        fields: [classes.teacherId],
        references: [user.id],
    }),
    enrollments: many(enrollments)
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
    student: one(user, {
        fields: [enrollments.studentId],
        references: [user.id],
    }),
    class: one(classes, {
        fields: [enrollments.classId],
        references: [classes.id],
    }),
}));

export const teacherDepartmentsRelations = relations(teacherDepartments, ({ one }) => ({
    teacher: one(user, {
        fields: [teacherDepartments.teacherId],
        references: [user.id],
    }),
    department: one(departments, {
        fields: [teacherDepartments.departmentId],
        references: [departments.id],
    }),
}));

export const teacherClassesRelations = relations(teacherClasses, ({ one }) => ({
    teacher: one(user, {
        fields: [teacherClasses.teacherId],
        references: [user.id],
    }),
    class: one(classes, {
        fields: [teacherClasses.classId],
        references: [classes.id],
    }),
}));

export const studentsRelations = relations(students, ({ one }) => ({
    department: one(departments, {
        fields: [students.departmentId],
        references: [departments.id],
    }),
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export type TeacherDepartment = typeof teacherDepartments.$inferSelect;
export type NewTeacherDepartment = typeof teacherDepartments.$inferInsert;

export type TeacherClass = typeof teacherClasses.$inferSelect;
export type NewTeacherClass = typeof teacherClasses.$inferInsert;

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;