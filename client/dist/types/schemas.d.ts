import { z } from 'zod';
export declare const nodeRefSchema: z.ZodObject<{
    type: z.ZodEnum<{
        section: "section";
        page: "page";
        row: "row";
        column: "column";
        element: "element";
    }>;
    id: z.ZodNumber;
}, z.core.$strip>;
declare const gridSettingsSchema: z.ZodObject<{
    default: z.ZodObject<{
        width: z.ZodNumber;
        offset: z.ZodNumber;
        visible: z.ZodBoolean;
    }, z.core.$strip>;
    overrides: z.ZodPreprocess<z.ZodRecord<z.ZodString, z.ZodObject<{
        width: z.ZodNumber;
        offset: z.ZodNumber;
        visible: z.ZodBoolean;
    }, z.core.$strip>>>;
}, z.core.$strip>;
declare const allowedTypeInfoSchema: z.ZodObject<{
    label: z.ZodString;
    icon: z.ZodString;
    description: z.ZodString;
}, z.core.$strip>;
declare const baseFieldsWireSchema: z.ZodObject<{
    self: z.ZodObject<{
        type: z.ZodEnum<{
            section: "section";
            page: "page";
            row: "row";
            column: "column";
            element: "element";
        }>;
        id: z.ZodNumber;
    }, z.core.$strip>;
    parent: z.ZodObject<{
        type: z.ZodEnum<{
            section: "section";
            page: "page";
            row: "row";
            column: "column";
            element: "element";
        }>;
        id: z.ZodNumber;
    }, z.core.$strip>;
    title: z.ZodString;
    blockSchema: z.ZodObject<{
        typeName: z.ZodString;
        label: z.ZodString;
        icon: z.ZodString;
        type: z.ZodString;
        title: z.ZodString;
    }, z.core.$strip>;
    obsoleteClassName: z.ZodNullable<z.ZodString>;
    version: z.ZodNumber;
    canDelete: z.ZodBoolean;
    canPublish: z.ZodBoolean;
    canUnpublish: z.ZodBoolean;
    canCreate: z.ZodBoolean;
    editLink: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        draft: "draft";
        published: "published";
        modified: "modified";
        removed: "removed";
    }>;
    summary: z.ZodOptional<z.ZodString>;
    extensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
/**
 * Recursive node schema. PHP's `GridNode::jsonSerialize()` emits
 * `containerType`/`allowedTypes`/`children` only on container nodes and
 * `gridSettings` only on columns; leaf elements omit all four fields.
 *
 * Modeled as a discriminated union once `containerType` is widened with
 * `.optional()` for the leaf variant — Zod's `discriminatedUnion` requires
 * every variant to declare the discriminant key, so leaves declare it as
 * the literal `undefined`.
 */
type ElementNodeWire = z.infer<typeof baseFieldsWireSchema> & ({
    containerType?: undefined;
} | {
    containerType: 'section' | 'row';
    allowedTypes: Record<string, z.infer<typeof allowedTypeInfoSchema>> | null;
    children: ElementNodeWire[] | null;
} | {
    containerType: 'column';
    allowedTypes: Record<string, z.infer<typeof allowedTypeInfoSchema>> | null;
    children: ElementNodeWire[] | null;
    gridSettings: z.infer<typeof gridSettingsSchema>;
});
export declare const elementNodeWireSchema: z.ZodType<ElementNodeWire>;
export declare const treeApiResponseWireSchema: z.ZodObject<{
    rootParent: z.ZodObject<{
        type: z.ZodEnum<{
            section: "section";
            page: "page";
            row: "row";
            column: "column";
            element: "element";
        }>;
        id: z.ZodNumber;
    }, z.core.$strip>;
    nodes: z.ZodArray<z.ZodType<ElementNodeWire, unknown, z.core.$ZodTypeInternals<ElementNodeWire, unknown>>>;
}, z.core.$strip>;
export declare const acceptableContainerSchema: z.ZodObject<{
    id: z.ZodNumber;
    title: z.ZodString;
    type: z.ZodEnum<{
        section: "section";
        row: "row";
        column: "column";
    }>;
}, z.core.$strip>;
export declare const acceptableContainerListSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    title: z.ZodString;
    type: z.ZodEnum<{
        section: "section";
        row: "row";
        column: "column";
    }>;
}, z.core.$strip>>;
export declare const pageEntrySchema: z.ZodObject<{
    id: z.ZodNumber;
    title: z.ZodString;
    parentId: z.ZodNumber;
    hasGridZones: z.ZodBoolean;
}, z.core.$strip>;
export declare const pageEntryListSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    title: z.ZodString;
    parentId: z.ZodNumber;
    hasGridZones: z.ZodBoolean;
}, z.core.$strip>>;
export declare const zoneListSchema: z.ZodArray<z.ZodString>;
export {};
