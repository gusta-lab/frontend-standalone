export interface TemplateProperty {
  title: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  enum?: string[];
  enumNames?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  'ui:autofocus'?: boolean;
  'ui:widget'?: string;
  items?: { type?: string; enum?: string[]; enumNames?: string[] };
  properties?: Record<string, TemplateProperty>;
  required?: string[];
}

export interface TemplateParameterGroup {
  title: string;
  required?: string[];
  properties?: Record<string, TemplateProperty>;
}

export interface Template {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    title?: string;
    description?: string;
    tags?: string[];
    uid?: string;
  };
  spec: {
    owner: string;
    type: string;
    parameters?: TemplateParameterGroup[];
  };
}

export interface ScaffoldLink {
  title: string;
  url?: string;
  entityRef?: string;
  icon?: string;
}

export interface ScaffoldOutput {
  links?: ScaffoldLink[];
  text?: Array<{ title: string; content: string }>;
}

export interface CatalogEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    title?: string;
    description?: string;
    tags?: string[];
    uid?: string;
    annotations?: Record<string, string>;
    links?: Array<{ url: string; title?: string; icon?: string }>;
  };
  spec: {
    type?: string;
    lifecycle?: string;
    owner?: string;
  };
}

export interface ScaffolderTask {
  id: string;
  spec: {
    templateInfo?: {
      entityRef: string;
      entity?: { metadata: { title?: string; name: string } };
    };
    parameters: Record<string, unknown>;
    steps: Array<{ id: string; name: string; action: string }>;
  };
  status: 'open' | 'processing' | 'failed' | 'cancelled' | 'completed';
  createdAt: string;
  output?: {
    text?: Array<{ title: string; content: string }>;
    links?: Array<{ title: string; url?: string; entityRef?: string; icon?: string }>;
  };
}
