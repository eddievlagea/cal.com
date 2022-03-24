import { PeriodType, SchedulingType } from "@calcom/prisma/client";

const commons = {
  periodCountCalendarDays: null,
  periodStartDate: Date.now(),
  periodEndDate: Date.now(),
  beforeEventBuffer: 0,
  afterEventBuffer: 0,
  periodType: PeriodType.UNLIMITED,
  periodDays: null,
  slotInterval: null,
  minimumBookingNotice: 120,
  schedule: null,
  timeZone: null,
  availability: [],
  price: 0,
  currency: "usd",
  schedulingType: SchedulingType.COLLECTIVE,
  id: 0,
  metadata: {},
  description: "",
  hidden: false,
  isWeb3Active: false,
  users: [
    {
      name: "" || null,
      username: "" || null,
      avatar: null,
      hideBranding: true,
      timeZone: null,
      availability: [],
    },
  ],
};

const min15Event = {
  length: 15,
  slug: "15min",
  title: "15min",
  ...commons,
};
const min30Event = {
  length: 30,
  slug: "30min",
  title: "30min",
  ...commons,
};
const min60Event = {
  length: 60,
  slug: "60min",
  title: "60min",
  ...commons,
};

const defaultEvents = [min15Event, min30Event, min60Event];

export const getDefaultEvent = (slug: string) => {
  const event = defaultEvents.find((obj) => {
    return obj.slug === slug;
  });
  return event || min15Event;
};

export const getGroupName = (usernameList: string[]): string => {
  return usernameList.toString();
};

export const getUsernameSlugLink = ({ users, slug }): string => {
  let slugLink = ``;
  if (users.length > 1) {
    let combinedUsername = ``;
    for (let i = 0; i < users.length - 1; i++) {
      combinedUsername = `${users[i].username}+`;
    }
    combinedUsername = `${combinedUsername}${users[users.length - 1].username}`;
    slugLink = `/${combinedUsername}/${slug}`;
  } else {
    slugLink = `/${users[0].username}/${slug}`;
  }
  return slugLink;
};

export default defaultEvents;